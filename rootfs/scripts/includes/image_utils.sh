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


## Attempts to enable the given binfmt rule, and errors if it doesn't stick. The
## corresponding reset_binfmt_rules function should be called before exit.
##
## Example:
##   enable_binfmt_rule qemu-aarch64
function enable_binfmt_rule {
  local RULE="$1"
  (set +e; update-binfmts --display "$RULE" &>/dev/null)
  if [ "$?" -ne 0 ]; then
    return 1  # Rule probably does not exist
  elif update-binfmts --display "$RULE" | grep -q '(disabled)'; then
    # Attempt to enable it, then check again
    update-binfmts --enable "$RULE" 2>/dev/null
    if update-binfmts --display "$RULE" | grep -q '(disabled)'; then
      return 1
    fi
    ENABLED_BINFMT_RULES+=("$RULE")
  fi
  return 0
}


## Reverts all changes to binfmt rules
function reset_binfmt_rules {
  for RULE in "${ENABLED_BINFMT_RULES[@]}"; do
    update-binfmts --disable "$RULE"
  done
}


## Outputs the interpreter used for a specific binfmt rule
function binfmt_interpreter {
  local RULE="$1"
  (set +e; update-binfmts --display "$RULE" &>/dev/null)
  [ "$?" -ne 0 ] && return 1  # Rule probably does not exist
  update-binfmts --display "$RULE" | grep 'interpreter =' | cut -d ' ' -f 4-
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
