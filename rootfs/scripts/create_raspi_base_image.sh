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
#     --mindisk
#         Create an image with a smaller disk image size than the default (useful for Cloud machines)
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
RASPI_FIRMWARE_VERSION=1.20220331

# Default options that might be overridden
ROOTFS_BUILD_PATH="$TOPLEVEL/rootfs"
DEFAULT_IMAGE_NAME=jaiabot_img-"$ROOTFS_BUILD_TAG".img
OUTPUT_IMAGE_PATH="$(pwd)"/"$DEFAULT_IMAGE_NAME"
ROOTFS_TARBALL=
DISTRIBUTION=focal

# Ensure user is root
if [ "$UID" -ne 0 ]; then
    echo "This script must be run as root; e.g. using 'sudo'" >&2
    exit 1
fi


# Set up an exit handler to clean up after ourselves
function finish {
  ( # Run in a subshell to ignore errors
    set +e
    
    # Undo changes to the binfmt configuration
    reset_binfmt_rules
  
    # Unmount the partitions
    [ -z "$DEBUG" ] &&
        ( sudo umount "$ROOTFS_PARTITION"/boot/firmware
          sudo umount "$ROOTFS_PARTITION"/dev/pts
          sudo umount "$ROOTFS_PARTITION"/dev
          sudo umount "$ROOTFS_PARTITION"/proc
          sudo umount "$ROOTFS_PARTITION"/sys
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
  --mindisk)
    MINDISK=1
    ;;
  --distribution)
    DISTRIBUTION="$1"
    shift
    ;;
  *)
    echo "Unexpected argument: $KEY" >&2
    exit 1
  esac
done

if [[ "$NATIVE" == "1" ]]; then
    if [[ $(arch) != "aarch64"  ]]; then
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
echo "Building bootable Raspberry Pi image in $WORKDIR"
cd "$WORKDIR"

# Create a 17.0 GiB image
SD_IMAGE_PATH="$OUTPUT_IMAGE_PATH"

# Apply the partition map
# 256 MB boot
# 8 GB underlay ro rootfs
# 8 GB (4GB for --mindisk) overlay upper rw
# 200 MB (to resize to fill disk) log partition 
if [[ "$MINDISK" == "1" ]]; then
    dd if=/dev/zero of="$SD_IMAGE_PATH" bs=1048576 count=13000 conv=sparse status=none
    sfdisk --quiet "$SD_IMAGE_PATH" <<EOF
label: dos 
device: /dev/sdc
unit: sectors

/dev/sdc1 : start=        8192, size=      524288, type=c, bootable
/dev/sdc2 : start=      532480, size=    16777216, type=83
/dev/sdc3 : start=    17309696, size=     8388608, type=83
/dev/sdc4 : start=    25698304, size=      409600, type=83
EOF
else
    dd if=/dev/zero of="$SD_IMAGE_PATH" bs=1048576 count=17000 conv=sparse status=none
    sfdisk --quiet "$SD_IMAGE_PATH" <<EOF
label: dos 
device: /dev/sdc
unit: sectors

/dev/sdc1 : start=        8192, size=      524288, type=c, bootable
/dev/sdc2 : start=      532480, size=    16777216, type=83
/dev/sdc3 : start=    17309696, size=    16777216, type=83
/dev/sdc4 : start=    34086912, size=      409600, type=83
EOF
fi

# Set up loop device for the partitions
attach_image "$SD_IMAGE_PATH" BOOT_DEV ROOTFS_DEV OVERLAY_DEV DATA_DEV

DISK_DEV=$(echo "$BOOT_DEV" | sed 's|mapper/\(loop[0-9]*\).*|\1|')

# Format the partitions
sudo mkfs.vfat -F 32 -n boot "$BOOT_DEV"
sudo mkfs.ext4 -L rootfs "$ROOTFS_DEV"
sudo mkfs.btrfs -L overlay "$OVERLAY_DEV"
sudo mkfs.btrfs -L data "$DATA_DEV"

# Mount the partitions
mkdir boot rootfs
BOOT_PARTITION="$WORKDIR"/boot 
ROOTFS_PARTITION="$WORKDIR"/rootfs

sudo mount "$BOOT_DEV" "$BOOT_PARTITION"
sudo mount "$ROOTFS_DEV" "$ROOTFS_PARTITION"

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
    echo "JAIABOT_IMAGE_BUILD_DATE=\"`date -u`\""  >> config/includes.chroot/etc/jaiabot/version
    echo "RASPI_FIRMWARE_VERSION=$RASPI_FIRMWARE_VERSION"  >> config/includes.chroot/etc/jaiabot/version

    # Do not include cloud packages in Raspi image - cloud-init seems to cause long hangs on first-boot
    [ -z "$VIRTUALBOX" ] && rm config/package-lists/cloud.list.chroot
    
    lb build
    cd ..
    ROOTFS_TARBALL=rootfs-build/binary-tar.tar.gz
fi

# Install the rootfs tarball to the partition
sudo tar -C "$ROOTFS_PARTITION" --strip-components 1 \
  -xpzf "$ROOTFS_TARBALL"

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
cat > "$BOOT_PARTITION"/cmdline.txt <<EOF
console=tty1 root=LABEL=rootfs rootfstype=ext4 fsck.repair=yes rootwait fixrtc net.ifnames=0 dwc_otg.lpm_enable=0
EOF

# Flash the kernel
sudo mkdir -p "$ROOTFS_PARTITION"/boot/firmware
sudo mount -o bind "$BOOT_PARTITION" "$ROOTFS_PARTITION"/boot/firmware
sudo mount -o bind /dev "$ROOTFS_PARTITION"/dev
sudo mount -o bind /dev/pts "$ROOTFS_PARTITION"/dev/pts
sudo mount -o bind /proc "$ROOTFS_PARTITION"/proc
sudo mount -o bind /sys "$ROOTFS_PARTITION"/sys

# Persist the rootfs in case we want it
OUTPUT_ROOTFS_TARBALL=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.tar.gz/")
OUTPUT_METADATA=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.metadata.txt/")
cp "${ROOTFS_TARBALL}" "${OUTPUT_ROOTFS_TARBALL}"

# Copy the preseed example on the boot partition
sudo mkdir -p "$BOOT_PARTITION"/jaiabot/init
sudo cp "$ROOTFS_PARTITION"/etc/jaiabot/init/first-boot.preseed.ex "$BOOT_PARTITION"/jaiabot/init

# Write metadata
echo "export JAIABOT_ROOTFS_GEN_TAG='$ROOTFS_BUILD_TAG'" > ${OUTPUT_METADATA}
echo "export JAIABOT_VERSION='$JAIABOT_VERSION'" >> ${OUTPUT_METADATA}
echo "export GOBY_VERSION='$GOBY_VERSION'" >> ${OUTPUT_METADATA}

if [ ! -z "$VIRTUALBOX" ]; then
    sudo chroot rootfs apt-get -y install linux-image-generic
    
    # ensure VM uses eth0, etc. naming like Raspi
    sudo chroot rootfs sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT=.*/GRUB_CMDLINE_LINUX_DEFAULT="net.ifnames=0 biosdevname=0"/' /etc/default/grub

    # reduce grub timeout
    sudo chroot rootfs sed -i 's/GRUB_TIMEOUT_STYLE=\(.*\)/#GRUB_TIMEOUT_STYLE=\1/' /etc/default/grub
    sudo chroot rootfs sed -i 's/GRUB_TIMEOUT=.*/GRUB_TIMEOUT=3\nGRUB_RECORDFAIL_TIMEOUT=3/' /etc/default/grub

    # install grub boot loader
    sudo chroot rootfs update-grub
    sudo chroot rootfs grub-install "$DISK_DEV"

    # unmount all the image partitions first
    finish
    
    OUTPUT_IMAGE_IMG=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.vdi$/\.img/")
    [[ "$OUTPUT_IMAGE_IMG" != "$OUTPUT_IMAGE_PATH" ]] && mv $OUTPUT_IMAGE_PATH $OUTPUT_IMAGE_IMG
    
    OUTPUT_IMAGE_VDI=$(echo $OUTPUT_IMAGE_PATH | sed "s/\.img$/\.vdi/")
    VBoxManage convertdd $OUTPUT_IMAGE_IMG $OUTPUT_IMAGE_VDI
    if [[ "$MINDISK" == "1" ]]; then
        VBoxManage modifyhd $OUTPUT_IMAGE_VDI --resize 16000
    else
        VBoxManage modifyhd $OUTPUT_IMAGE_VDI --resize 32000
    fi
    # TODO - remove!!
    sudo chown 1000:1000 $OUTPUT_IMAGE_VDI

    # Turn the VDI disk into a full VM
    create_virtualbox $OUTPUT_IMAGE_VDI

    OUTPUT_IMAGE_OVA=$(echo $OUTPUT_IMAGE_VDI | sed "s/\.vdi$/\.ova/")
    
    echo "Virtualbox OVA created at $OUTPUT_IMAGE_OVA, VDI created at $OUTPUT_IMAGE_VDI, img at $OUTPUT_IMAGE_IMG"
else
    sudo chroot rootfs apt-get -y install linux-image-raspi
    echo "Raspberry Pi image created at $OUTPUT_IMAGE_PATH"
fi
