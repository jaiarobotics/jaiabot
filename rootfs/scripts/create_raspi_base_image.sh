#!/bin/bash -e
# Copyright 2022: JaiaRobotics LLC
# Distribution per terms of original project (below)
#
# Forked from original project:
#
# Copyright (C) 2019 Woods Hole Oceanographic Institution
#
# This file is part of the CGSN Mooring Project ("cgsn-mooring").
#
# cgsn-mooring is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 2 of the License, or
# (at your option) any later version.
#
# cgsn-mooring is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with cgsn-mooring in the COPYING.md file at the project root.
# If not, see <http://www.gnu.org/licenses/>.
################################################################################
# This tool creates a bootable Raspberry Pi image that is ready to flash to an
# SD card. Add packages to the image using the install_into_image.sh tool.
#
# Options:
#
#     --firmware firmware.tgz
#         The path to a tarball containing pre-built Raspberry Pi boot partition
#         files. If omitted, a copy will be downloaded.
#
#     --rootfs binary-tar.tar.gz
#         The path to a tarball containing a live-build generated rootfs. If omitted
#         the rootfs will be build using live-build.
#
#     --dest directory|file.img
#         If an existing directory, the image file will be written to it using
#         the default name format. If not,
#         assumed to be the specific image name you want.
#
#     --debug
#         If an error happens, do not remove the scratch directory.
#
#     --native
#         Run on native aarch64 hardware, rather than emulate building with QEMU
#
#     --virtualbox
#         Create an amd64 virtualbox VDI, rather than a Raspi SD card image (but otherwise create a very similar image)
#
#     --distribution
#         Desired Ubuntu distribution codename (e.g., "focal" or "jammy")
# 
#     --repo
#         Desired Jaiabot repo ("release", "continuous", "beta", "test")
#
#     --version
#         Desired Jaiabot version ("1.y", "2.y")
# 
# This script is invoked by the raspi-image-master job in the cgsn_mooring
# project's CircleCI but can also be invoked directly.
#
# Please see the cgsn_mooring/.circleci/master-raspi-docker/Dockerfile for a
# list of packages that may be needed for this tool.
################################################################################

shopt -s nullglob
. "$(cd "$(dirname "$0")"; pwd)"/includes/image_utils.sh

TOPLEVEL="$(cd "$(dirname "$0")"; git rev-parse --show-toplevel)"

ROOTFS_BUILD_TAG="$(cd "$(dirname "$0")"; git describe --tags HEAD | sed 's/_/~/' | sed 's/-/+/g')"
DATE="$(date +%Y%m%d)"
WORKDIR="$(mktemp -d)"
STARTDIR="$(pwd)"

# Default options that might be overridden
ROOTFS_BUILD_PATH="$TOPLEVEL/rootfs"
DEFAULT_IMAGE_NAME=jaiabot_img-"$ROOTFS_BUILD_TAG".img
OUTPUT_IMAGE_PATH="$(pwd)"/"$DEFAULT_IMAGE_NAME"
ROOTFS_TARBALL=

set -a; source ${TOPLEVEL}/scripts/common-versions.env; set +a
DISTRIBUTION=${jaia_version_ubuntu_codename}
JAIABOT_VERSION=${jaia_version_release_branch}
JAIABOT_REPO=release
RASPI_FIRMWARE_VERSION=${jaia_version_raspi_firmware}


# Ensure user is root
if [ "$UID" -ne 0 ]; then
    echo "This script must be run as root; e.g. using 'sudo'" >&2
    exit 1
fi

function unmount_bind_mounts {
    sudo umount "$ROOTFS_PARTITION"/boot/firmware || true
    sudo umount "$ROOTFS_PARTITION"/dev/pts || true
    sudo umount "$ROOTFS_PARTITION"/dev || true
    sudo umount "$ROOTFS_PARTITION"/proc || true
    sudo umount "$ROOTFS_PARTITION"/sys || true
}


# Set up an exit handler to clean up after ourselves
function finish {
  ( # Run in a subshell to ignore errors
    set +e
    
    # Undo changes to the binfmt configuration
    reset_binfmt_rules
  
    # Unmount the partitions
    [ -z "$DEBUG" ] &&
        ( unmount_bind_mounts
          sudo umount "$ROOTFS_PARTITION"
          sudo umount "$BOOT_PARTITION"
          
          # Detach the loop devices
          detach_image "$SD_IMAGE_PATH"
          # Remove the scratch directory
          cd / && rm -Rf "$WORKDIR"
        )
  ) &>/dev/null || true
}
trap finish EXIT


# Parse command-line options
while [[ $# -gt 0 ]]; do
  OPTION="$1"
  shift
  case "$OPTION" in
  --firmware)
    FIRMWARE_PATH="$(cd "$(dirname "$1")"; pwd)/$(basename "$1")"
    shift
    ;;
  --dest)
    if [ -d "$1" ]; then
      OUTPUT_IMAGE_PATH="$(cd "$1"; pwd)"/"$DEFAULT_IMAGE_NAME"
    else
      OUTPUT_IMAGE_PATH="$(cd "$(dirname "$1")"; pwd)/$(basename "$1")"
    fi
    shift
    ;;
  --rootfs-build)
    ROOTFS_BUILD_PATH="$(cd "$1"; pwd)"
    shift
    ;;
  --rootfs)
    ROOTFS_TARBALL="$(cd "$(dirname "$1")"; pwd)/$(basename "$1")"
    shift
    ;;
  --debug)
    DEBUG=1
    set -x
    ;;
  --native)
    NATIVE=1
    ;;
  --virtualbox)
    VIRTUALBOX=1
    ;;
  --distribution)
    DISTRIBUTION="$1"
    shift
    ;;
  --repo)
    JAIABOT_REPO="$1"
    shift
    ;;
  --version)
    JAIABOT_VERSION="$1"
    shift
    ;;
  *)
    echo "Unexpected argument: $KEY" >&2
    exit 1
  esac
done


if [[ "$NATIVE" == "1" ]]; then
    if [[ $(arch) != "aarch64" ]]; then
        echo "This system is not suitable for a native build"
        exit 1
    fi
elif [ ! -z "$VIRTUALBOX" ]; then
    # No need for QEMU on Virtualbox
    :
elif ! enable_binfmt_rule qemu-aarch64; then
    # Test that executing foreign binaries under QEMU will work
    echo "This system cannot execute ARM binaries under QEMU" >&2
    exit 1
fi

# Let's go!
echo "Building bootable Raspberry Pi image in $WORKDIR: distro=${DISTRIBUTION}, version=${JAIABOT_VERSION}, repo=${JAIABOT_REPO}"
cd "$WORKDIR"

# Create a 17.0 GiB image
SD_IMAGE_PATH="$OUTPUT_IMAGE_PATH"

# Apply the partition map
# 512 MB boot
#   NOTE: bumped from 256 MB. The piboot-try (A/B) boot layout introduced in
#   Ubuntu questing (25.10) keeps up to two full sets of boot assets on the
#   boot partition (current/ + new/, and transiently old/). Each set contains
#   vmlinuz, initrd.img, all base DTBs and all overlays. With Ubuntu's raspi
#   initramfs this can approach ~100 MB per set, which does not comfortably
#   fit alongside the bootloader assets in 256 MB.
# 8 GB underlay ro rootfs
# 200 MB (to resize to fill disk) log partition
dd if=/dev/zero of="$SD_IMAGE_PATH" bs=1048576 count=17300 conv=sparse status=none
sfdisk "$SD_IMAGE_PATH" <<EOF
label: gpt
size=512MiB, type=EBD0A0A2-B9E5-4433-87C0-68B6B72699C7
size=8GiB, type=linux
size=8GiB, type=linux
size=200MiB, type=linux
EOF

# Set up loop device for the partitions
attach_image "$SD_IMAGE_PATH" BOOT_DEV ROOTFS_DEV OVERLAY_DEV DATA_DEV

DISK_DEV=$(echo "$BOOT_DEV" | sed 's|mapper/\(loop[0-9]*\).*|\1|')

# Format the partitions
sudo mkfs.vfat -F 32 -n boot "$BOOT_DEV"
sudo mkfs.btrfs -L rootfs "$ROOTFS_DEV"
sudo mkfs.btrfs -L overlay "$OVERLAY_DEV"
sudo mkfs.btrfs -L data "$DATA_DEV"

# Mount the partitions
mkdir boot rootfs
BOOT_PARTITION="$WORKDIR"/boot
ROOTFS_PARTITION="$WORKDIR"/rootfs

sudo mount "$BOOT_DEV" "$BOOT_PARTITION"
sudo mount "$ROOTFS_DEV" "$ROOTFS_PARTITION"

if command -v pigz >/dev/null 2>&1; then
    COMPRESSOR="pigz"
else
    COMPRESSOR="gzip"
fi

if [ -z "$ROOTFS_TARBALL" ]; then
    # Build the rootfs
    mkdir rootfs-build
    cp -r "$ROOTFS_BUILD_PATH"/auto "$ROOTFS_BUILD_PATH"/customization "$ROOTFS_BUILD_PATH"/virtualbox rootfs-build
    cd rootfs-build
    # remove any existing cached data
    rm -rf cache
    lb clean
    [ -z "$NATIVE" ] && cp auto/config.qemu auto/config || cp auto/config.native auto/config
    [ ! -z "$VIRTUALBOX" ] && cp auto/config.virtualbox auto/config

    sed -i "s/--distribution.*\\\/--distribution ${DISTRIBUTION} \\\/" auto/config
    lb config
    mkdir -p config/includes.chroot/etc/jaiabot
    chmod 775 config/includes.chroot/etc/jaiabot
    echo "JAIABOT_IMAGE_VERSION=$ROOTFS_BUILD_TAG" >> config/includes.chroot/etc/jaiabot/version
    echo "JAIABOT_IMAGE_BUILD_DATE=\"`date -u`\"" >> config/includes.chroot/etc/jaiabot/version
    echo "RASPI_FIRMWARE_VERSION=$RASPI_FIRMWARE_VERSION" >> config/includes.chroot/etc/jaiabot/version
    sed -i "s/@DISTRIBUTION@/${DISTRIBUTION}/" config/archives/jaiabot.list.chroot
    sed -i "s/@JAIABOT_REPO@/${JAIABOT_REPO}/" config/archives/jaiabot.list.chroot
    sed -i "s/@JAIABOT_VERSION@/${JAIABOT_VERSION}/" config/archives/jaiabot.list.chroot

    # Do not include cloud packages in Raspi image - no need for s3fs 
    [ -z "$VIRTUALBOX" ] && rm config/package-lists/cloud.list.chroot

    # Newer Ubuntu releases may not be known to the version of debootstrap
    # installed on the build host. In that case, create a symlink from the
    # requested codename to "gutsy", which all Ubuntu releases since gutsy
    # share as their bootstrap script.
    if [ ! -f /usr/share/debootstrap/scripts/${DISTRIBUTION} ] && \
       [ ! -L /usr/share/debootstrap/scripts/${DISTRIBUTION} ]; then
        ln -s /usr/share/debootstrap/scripts/gutsy \
            /usr/share/debootstrap/scripts/${DISTRIBUTION}
    fi

    lb build
    # Need xattrs for ping setcap
    tar --xattrs --xattrs-include="*" -cf - binary | $COMPRESSOR > binary-tar-xattrs.tar.gz
    cd ..
    ROOTFS_TARBALL=rootfs-build/binary-tar-xattrs.tar.gz
fi

# Install the rootfs tarball to the partition
sudo tar -C "$ROOTFS_PARTITION" --strip-components 1 \
   --xattrs --xattrs-include="*" -xpzf "$ROOTFS_TARBALL"

GOBY_VERSION=$(chroot $ROOTFS_PARTITION dpkg-query -W -f='${Version}' libgoby3 | cut -d - -f 1)
JAIABOT_VERSION=$(chroot $ROOTFS_PARTITION dpkg-query -W -f='${Version}' libjaiabot | cut -d - -f 1)

# Download the Raspberry Pi firmware tarball if we don't have it
if [ -z "$FIRMWARE_PATH" ]; then
  wget -O firmware.tgz https://github.com/raspberrypi/firmware/archive/refs/tags/${RASPI_FIRMWARE_VERSION}.tar.gz
  FIRMWARE_PATH="$WORKDIR"/firmware.tgz
fi

# Extract the firmware's boot/ directory to the boot partition
FIRMWARE_TOPLEVEL="$(tar -tf "$FIRMWARE_PATH" | head -n 1 | sed -e 's,/*$,,')"
sudo tar --exclude 'kernel*' -C "$BOOT_PARTITION" --strip-components 2 \
  -xzpf "$FIRMWARE_PATH" "$FIRMWARE_TOPLEVEL"/boot/

# Write configuration files for the Raspberry Pi
cat >> "$BOOT_PARTITION"/config.txt <<EOF
# Run in 64-bit mode
arm_64bit=1
dtoverlay=dwc2

# Disable compensation for displays with overscan
disable_overscan=1

[cm4]
# Enable host mode on the 2711 built-in XHCI USB controller.
# This line should be removed if the legacy DWC2 controller is required
# (e.g. for USB device mode) or if USB support is not required.
otg_mode=1

# Enable the USB2 outputs on the IO board (assuming your CM4 is plugged into
# such a board)
dtoverlay=dwc2,dr_mode=host

[all]

[pi4]
# Run as fast as firmware / board allows
arm_boost=1

[all]
initramfs initrd.img followkernel
kernel=vmlinuz

# from Ubuntu image sysconfig.txt
enable_uart=1
dtparam=audio=on
dtparam=i2c_arm=on
dtparam=spi=on
cmdline=cmdline.txt

# jaiabot
dtoverlay=disable-bt
dtoverlay=uart3,txd3_pin=7,rxd3_pin=29
dtoverlay=uart4,txd4_pin=24,rxd4_pin=21
dtoverlay=uart5,txd5_pin=32,rxd5_pin=33
dtoverlay=spi1-3cs
EOF

# The piboot-try (A/B) boot mechanism redirects the boot to new/ via a
# [tryboot] filter inside config.txt. However, in "tryboot" mode the Pi
# bootloader reads tryboot.txt *instead of* config.txt by default, which would
# cause that filter never to be honoured. Setting tryboot_a_b=1 in autoboot.txt
# forces the bootloader to always read config.txt, in both normal and tryboot
# mode. flash-kernel's pi-try migration normally writes this file; we create it
# explicitly so the image does not depend on that side effect.
cat > "$BOOT_PARTITION"/autoboot.txt <<EOF
[all]
tryboot_a_b=1
EOF

# panic=10 is required by the piboot-try fallback design: on a kernel panic (or
# a failed initramfs) the machine resets after 10s rather than hanging or
# dropping to a busybox shell, which lets the ephemeral tryboot flag clear and
# the bootloader fall back to the known-good assets in current/.
cat > "$BOOT_PARTITION"/cmdline.txt <<EOF
console=tty1 root=LABEL=rootfs rootfstype=btrfs fsck.repair=yes rootwait fixrtc panic=10 net.ifnames=0 dwc_otg.lpm_enable=0 ds=nocloud;s=file:///etc/jaiabot/init/ network-config=disabled
EOF

# Flash the kernel
sudo mkdir -p "$ROOTFS_PARTITION"/boot/firmware
sudo mount -o bind "$BOOT_PARTITION" "$ROOTFS_PARTITION"/boot/firmware
sudo mount -o bind /dev "$ROOTFS_PARTITION"/dev
sudo mount -o bind /dev/pts "$ROOTFS_PARTITION"/dev/pts
sudo mount -o bind /proc "$ROOTFS_PARTITION"/proc
sudo mount -o bind /sys "$ROOTFS_PARTITION"/sys

OUTPUT_METADATA=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.metadata\.txt/")

# Copy the cloud init info to the boot partition where it is more easily modified on a Windows machine
sudo mkdir -p "$BOOT_PARTITION"/jaiabot/init
sudo cp "$ROOTFS_PARTITION"/etc/jaiabot/init/first-boot.preseed.yml.j2 "$BOOT_PARTITION"/jaiabot/init

# Write metadata
echo "export JAIABOT_ROOTFS_GEN_TAG='$ROOTFS_BUILD_TAG'" > ${OUTPUT_METADATA}
echo "export JAIABOT_VERSION='$JAIABOT_VERSION'" >> ${OUTPUT_METADATA}
echo "export GOBY_VERSION='$GOBY_VERSION'" >> ${OUTPUT_METADATA}

################################################################################
# Bootstrap the piboot-try (A/B) boot layout.
#
# Background: from Ubuntu questing (25.10) onwards, flash-kernel uses the
# "pi-try" method. Boot assets live in current/ (always known-good), new/
# (untested), and optionally old/ (previous known-good). config.txt selects
# between them with:
#
#     [all]
#     os_prefix=current/
#     [tryboot]
#     os_prefix=new/
#
# flash-kernel NEVER writes to current/. It only ever populates new/ and marks
# new/state as "unknown"; promotion of new/ -> current/ happens at runtime, via
# piboot-try-reboot.service (which reboots into tryboot mode) followed by
# piboot-try-validate.service (which promotes the assets if the boot succeeded).
#
# The only thing that creates current/ in the first place is flash-kernel's
# one-shot migration from the legacy layout -- and that migration can only move
# assets that are ALREADY in the root of the boot partition. In this build, the
# RPi firmware tarball is extracted with --exclude 'kernel*', and the Ubuntu
# kernel has not yet been written to the boot partition when flash-kernel runs.
# So the migration produces a current/ containing the DTBs, overlays and
# cmdline.txt, but no vmlinuz and no initrd.img.
#
# The result is an image that cannot boot even once ("kernel file
# current/vmlinuz does not exist" / "No compatible kernel found"), and because
# it never boots, the runtime services that would have promoted new/ to
# current/ never get a chance to run. Deadlock.
#
# We therefore perform the initial promotion here, at build time, mirroring
# exactly what piboot-try-validate would do after a successful tryboot.
################################################################################
function bootstrap_piboot_ab {
    local boot="$1"

    if [ ! -d "$boot"/new ]; then
        # Either flash-kernel used the legacy "pi" method (assets written to
        # the root of the boot partition), or it did not run at all. Nothing to
        # promote; leave the layout untouched.
        echo "bootstrap_piboot_ab: no new/ directory; assuming legacy (non-A/B) layout"
        return 0
    fi

    if [ ! -f "$boot"/new/vmlinuz ]; then
        echo "bootstrap_piboot_ab: new/vmlinuz missing - flash-kernel did not install a kernel" >&2
        return 1
    fi

    echo "bootstrap_piboot_ab: promoting new/ to current/"

    # current/ at this point holds only the partial assets produced by the
    # pi-try migration (no kernel), and old/ should not exist yet. Neither is
    # worth preserving in a freshly built image.
    sudo rm -rf "$boot"/current "$boot"/old
    sudo mv "$boot"/new "$boot"/current

    # current/state must always read "good": it is by definition the
    # known-good fallback set.
    echo good | sudo tee "$boot"/current/state >/dev/null

    sudo sync
}

# Verify the boot partition is in a state that will actually boot. This is a
# cheap check that would have caught the missing-kernel bug at build time
# rather than in the field.
function verify_boot_assets {
    local boot="$1"
    local rc=0

    for f in current/vmlinuz current/initrd.img current/cmdline.txt \
             current/state config.txt autoboot.txt; do
        if [ ! -f "$boot"/"$f" ]; then
            echo "verify_boot_assets: MISSING $f" >&2
            rc=1
        fi
    done

    if [ -f "$boot"/current/state ] && \
       [ "$(cat "$boot"/current/state)" != "good" ]; then
        echo "verify_boot_assets: current/state is not 'good'" >&2
        rc=1
    fi

    # config.txt must select current/ for a normal boot and new/ under tryboot.
    grep -q '^os_prefix=current/' "$boot"/config.txt || {
        echo "verify_boot_assets: config.txt has no 'os_prefix=current/'" >&2
        rc=1
    }
    grep -q '^os_prefix=new/' "$boot"/config.txt || {
        echo "verify_boot_assets: config.txt has no 'os_prefix=new/' under [tryboot]" >&2
        rc=1
    }

    # At least one base device tree must be present alongside the kernel.
    if [ -z "$(echo "$boot"/current/*.dtb)" ]; then
        echo "verify_boot_assets: no base device tree in current/" >&2
        rc=1
    fi

    echo "verify_boot_assets: boot partition usage:"
    df -h "$boot" | sed 's/^/    /'

    if [ "$rc" -eq 0 ]; then
        echo "verify_boot_assets: OK"
    fi
    return "$rc"
}

function create_tarballs {
    # Persist the rootfs and boot for release upgrades
    OUTPUT_ROOTFS_TARBALL=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.rootfs\.tar\.gz/")
    OUTPUT_BOOT_TARBALL=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.boot\.tar\.gz/")

    # Create tarball variants of image
    unmount_bind_mounts
    cd rootfs
    # Need xattrs for ping setcap
    tar --xattrs --xattrs-include="*" -cf - . | $COMPRESSOR > ${OUTPUT_ROOTFS_TARBALL}
    cd ../boot
    tar -cf - . | $COMPRESSOR > ${OUTPUT_BOOT_TARBALL}
    cd ..
}

if [ ! -z "$VIRTUALBOX" ]; then
    sudo chroot rootfs apt-get -y install linux-image-virtual grub-efi-amd64
    
    # ensure VM uses eth0, etc. naming like Raspi
    sudo chroot rootfs sed -i 's|GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT="net.ifnames=0 biosdevname=0"|' /etc/default/grub

    # reduce grub timeout
    sudo chroot rootfs sed -i 's/GRUB_TIMEOUT_STYLE=\(.*\)/#GRUB_TIMEOUT_STYLE=\1/' /etc/default/grub
    sudo chroot rootfs sed -i 's/GRUB_TIMEOUT=.*/GRUB_TIMEOUT=3\nGRUB_RECORDFAIL_TIMEOUT=3/' /etc/default/grub

    sudo mkdir -p "$ROOTFS_PARTITION"/boot/efi
    sudo mount -o bind "$BOOT_PARTITION" "$ROOTFS_PARTITION"/boot/efi
    
    # install grub boot loader
    sudo chroot rootfs update-grub
    sudo chroot rootfs grub-install "$DISK_DEV" --no-uefi-secure-boot --removable
    
    sudo umount "$ROOTFS_PARTITION"/boot/efi
    
    # use ipv6 and ipv4 resolv.conf for VirtualBox and AWS instances
    sudo chroot rootfs /bin/bash -c "cat /etc/resolv.conf.ipv6 /etc/resolv.conf.ipv4 > /etc/resolv.conf"

    create_tarballs
    
    # unmount all the image partitions first
    finish
    
    OUTPUT_IMAGE_IMG=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.vdi$/\.img/")
    [[ "$OUTPUT_IMAGE_IMG" != "$OUTPUT_IMAGE_PATH" ]] && mv $OUTPUT_IMAGE_PATH $OUTPUT_IMAGE_IMG
    
    OUTPUT_IMAGE_VDI=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.vdi/")
    VBoxManage convertdd $OUTPUT_IMAGE_IMG $OUTPUT_IMAGE_VDI
    VBoxManage modifyhd $OUTPUT_IMAGE_VDI --resize 32000
    # TODO - remove!!
    sudo chown 1000:1000 $OUTPUT_IMAGE_VDI

    # Turn the VDI disk into a full VM
    create_virtualbox $OUTPUT_IMAGE_VDI

    OUTPUT_IMAGE_OVA=$(echo $OUTPUT_IMAGE_VDI | sed "s/\.vdi$/\.ova/")
    
    echo "Virtualbox OVA created at $OUTPUT_IMAGE_OVA, VDI created at $OUTPUT_IMAGE_VDI, img at $OUTPUT_IMAGE_IMG"
else
    sudo chroot rootfs apt-get -y install linux-image-raspi

    ## Run flash-kernel manually once as it will not run automatically in CHROOT / EFI
    # Jammy flash-kernel checks for /sys/firmware/efi and bails
    sudo umount "$ROOTFS_PARTITION"/sys
    # Noble flash-kernel added FK_IGNORE_EFI
    # /boot/firmware is left ro by dpkg hook
    sudo chroot rootfs /bin/bash -c "mount -o remount,rw /boot/firmware; export FK_FORCE=yes; export FK_IGNORE_EFI=yes; flash-kernel"

    # flash-kernel has now migrated the boot partition to the piboot-try (A/B)
    # layout and written the real kernel assets to new/. Promote them to
    # current/ so that the very first boot has a known-good set to boot from.
    bootstrap_piboot_ab "$BOOT_PARTITION"

    # Fail the build rather than shipping an unbootable image.
    verify_boot_assets "$BOOT_PARTITION"

    create_tarballs
    
    echo "Raspberry Pi image created at $OUTPUT_IMAGE_PATH (also a copy of rootfs at $OUTPUT_ROOTFS_TARBALL and boot at $OUTPUT_BOOT_TARBALL)"
fi

