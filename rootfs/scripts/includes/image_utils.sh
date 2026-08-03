#!/bin/bash -e
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
# This file defines a few utility functions that are useful for tools that
# manipulate disk images, but it is not meant to be used directly.
################################################################################


ENABLED_BINFMT_RULES=()
REGISTERED_BINFMT_RULES=()


## Attempts to enable the given binfmt rule, and errors if it doesn't stick. The
## corresponding reset_binfmt_rules function should be called before exit.
##
## Two registration mechanisms are supported:
##
##   1. binfmt-support (update-binfmts, rules under /usr/share/binfmts). Used by
##      qemu-user-static before 8.0.0, i.e. Ubuntu <= 23.04.
##
##   2. systemd-binfmt (/proc/sys/fs/binfmt_misc, templates under
##      /usr/lib/binfmt.d). From qemu 8.0.0 onwards -- i.e. Ubuntu 23.10, 24.04
##      and later -- qemu-user-static dropped binfmt-support registration
##      entirely and ships only systemd binfmt.d templates. On those hosts
##      "update-binfmts --display qemu-aarch64" fails even though aarch64
##      emulation is working perfectly well, which used to make this function
##      report "This system cannot execute ARM binaries under QEMU".
##
## Example:
##   enable_binfmt_rule qemu-aarch64
function enable_binfmt_rule {
  local RULE="$1"

  # --- Mechanism 1: binfmt-support -------------------------------------------
  if command -v update-binfmts >/dev/null 2>&1 &&
     (set +e; update-binfmts --display "$RULE" &>/dev/null); then
    if update-binfmts --display "$RULE" | grep -q '(disabled)'; then
      # Attempt to enable it, then check again
      update-binfmts --enable "$RULE" 2>/dev/null
      if update-binfmts --display "$RULE" | grep -q '(disabled)'; then
        return 1
      fi
      ENABLED_BINFMT_RULES+=("$RULE")
    fi
    return 0
  fi

  # --- Mechanism 2: systemd-binfmt, already registered ------------------------
  if [ -e "/proc/sys/fs/binfmt_misc/$RULE" ]; then
    if head -n 1 "/proc/sys/fs/binfmt_misc/$RULE" | grep -q '^disabled'; then
      echo 1 > "/proc/sys/fs/binfmt_misc/$RULE" 2>/dev/null || return 1
      head -n 1 "/proc/sys/fs/binfmt_misc/$RULE" | grep -q '^disabled' && return 1
      ENABLED_BINFMT_RULES+=("$RULE")
    fi
    check_binfmt_fix_binary "$RULE"
    return 0
  fi

  # --- Mechanism 3: systemd-binfmt, not yet registered ------------------------
  # The rule exists as a template but has not been loaded (e.g. because
  # systemd-binfmt.service has not run, as happens in some containers and on
  # WSL). Register it directly.
  if [ ! -e /proc/sys/fs/binfmt_misc/register ]; then
    (set +e; modprobe binfmt_misc &>/dev/null)
    if [ ! -e /proc/sys/fs/binfmt_misc/register ]; then
      mount -t binfmt_misc binfmt_misc /proc/sys/fs/binfmt_misc &>/dev/null || true
    fi
  fi

  if [ -r "/usr/lib/binfmt.d/${RULE}.conf" ] && [ -w /proc/sys/fs/binfmt_misc/register ]; then
    # Skip comments/blank lines; the template is a single ':name:M::magic:mask:interp:flags' line
    grep -v -e '^#' -e '^[[:space:]]*$' "/usr/lib/binfmt.d/${RULE}.conf" \
      > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    if [ -e "/proc/sys/fs/binfmt_misc/$RULE" ]; then
      REGISTERED_BINFMT_RULES+=("$RULE")
      check_binfmt_fix_binary "$RULE"
      return 0
    fi
  fi

  return 1
}


## Warns if a binfmt rule lacks the 'F' (fix binary) flag. Without F the kernel
## resolves the interpreter path inside the chroot, so the emulator would have
## to be copied into the target rootfs for chroot'ed commands to work.
function check_binfmt_fix_binary {
  local RULE="$1"
  local FLAGS
  FLAGS=$(grep '^flags:' "/proc/sys/fs/binfmt_misc/$RULE" 2>/dev/null | cut -d ' ' -f 2-)
  if [ -n "$FLAGS" ] && [[ "$FLAGS" != *F* ]]; then
    echo "Warning: binfmt rule '$RULE' lacks the 'F' flag (flags: $FLAGS)." >&2
    echo "         The interpreter may need to be copied into the target rootfs." >&2
  fi
}


## Reverts all changes to binfmt rules
function reset_binfmt_rules {
  for RULE in "${ENABLED_BINFMT_RULES[@]}"; do
    if command -v update-binfmts >/dev/null 2>&1 &&
       (set +e; update-binfmts --display "$RULE" &>/dev/null); then
      update-binfmts --disable "$RULE"
    elif [ -e "/proc/sys/fs/binfmt_misc/$RULE" ]; then
      echo 0 > "/proc/sys/fs/binfmt_misc/$RULE" 2>/dev/null || true
    fi
  done
  # Rules we registered ourselves are removed entirely
  for RULE in "${REGISTERED_BINFMT_RULES[@]}"; do
    [ -e "/proc/sys/fs/binfmt_misc/$RULE" ] &&
      { echo -1 > "/proc/sys/fs/binfmt_misc/$RULE" 2>/dev/null || true; }
  done
}


## Outputs the interpreter used for a specific binfmt rule
function binfmt_interpreter {
  local RULE="$1"
  if command -v update-binfmts >/dev/null 2>&1 &&
     (set +e; update-binfmts --display "$RULE" &>/dev/null); then
    update-binfmts --display "$RULE" | grep 'interpreter =' | cut -d ' ' -f 4-
    return 0
  fi
  if [ -e "/proc/sys/fs/binfmt_misc/$RULE" ]; then
    grep '^interpreter ' "/proc/sys/fs/binfmt_misc/$RULE" | cut -d ' ' -f 2-
    return 0
  fi
  return 1
}


## Attaches an image file to loop devices and sets variables to the
## corresponding device paths.
##
## Example:
##   attach_image image.img BOOT_DEV ROOTFS_DEV
##   echo $BOOT_DEV  # /dev/mapper/loop3p1
function attach_image {
  local IMAGE="$1"
  shift
  local KPARTX_OUTPUT=$(sudo kpartx -v -a -s "$IMAGE")
  read -r "$@" \
    < <(echo "$KPARTX_OUTPUT" \
        | grep -E --only-matching 'add map \S+' \
        | cut -d ' ' -f 3 \
        | tr "\n" " " \
        ; echo)
  for VAR in "$@"; do
    eval "$VAR=/dev/mapper/\$$VAR"
  done
}


## Detaches an image file previously attached with attach_image
##
## Example:
##   detach_image image.img
function detach_image {
  sudo kpartx -d "$1"
}


function create_virtualbox {
    DISK=$1
    MACHINENAME="$(basename ${DISK%.*})"
    OVA=$(echo $DISK | sed "s/\.vdi$/\.ova/")
    
    # Create VM
    VBoxManage createvm --name $MACHINENAME --ostype "Ubuntu_64" --register --basefolder="$(dirname ${DISK})"
    # Set memory and network
    VBoxManage modifyvm $MACHINENAME --firmware efi    
    VBoxManage modifyvm $MACHINENAME --ioapic on
    VBoxManage modifyvm $MACHINENAME --memory 1024 --vram 128
    VBoxManage modifyvm $MACHINENAME --nic1 nat
    VBoxManage modifyvm $MACHINENAME --nic2 intnet
    VBoxManage modifyvm $MACHINENAME --intnet2 "jaiabotfleet"
    # Create Disk and connect Debian Iso
    VBoxManage storagectl $MACHINENAME --name "SATA Controller" --add sata --controller IntelAhci --portcount 2
    VBoxManage storageattach $MACHINENAME --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium  $DISK
    VBoxManage modifyvm $MACHINENAME --boot1 disk --boot2 none --boot3 none --boot4 none
    VBoxManage modifyvm $MACHINENAME --usbxhci on    

    echo "Exporting VM to ${OVA}"
    VBoxManage export $MACHINENAME --output "${OVA}"
}
