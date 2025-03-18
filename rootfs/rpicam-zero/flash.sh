#!/bin/bash

set -u -e


if [ ! $# -eq 2 ]; then
   echo "Usage $0 /dev/sdX images/jaiabot__rpicam-zero-bookworm.img"
   exit 1;
fi

out_disk=$1
img=$2

if [ ! -b $out_disk ]; then
    echo "$out_disk is not a block device"
    exit 1
fi

if [ ! -f $img ]; then
    echo "$img is not a file"
    exit 1
fi

sudo umount ${out_disk}? || true
sudo dd if=$img of=$out_disk status=progress bs=10M

#########################################
## Fill disk with exfat data partition ##
#########################################

bootfs_partition=1
rootfs_partition=2
data_partition=3

ROOTFS_END_SECTOR=$(sudo fdisk -l ${out_disk} | awk "\$1 == \"${out_disk}${rootfs_partition}\" {print \$3}")
DATA_START_SECTOR=$((ROOTFS_END_SECTOR + 1))

(
echo n    # Create new partition
echo p    # Primary partition
echo 3    # Partition number 3
echo ${DATA_START_SECTOR}
echo      # Default end (uses all available space)
echo w    # Write changes
) | sudo fdisk $out_disk

sudo partprobe $out_disk
sudo mkfs.exfat -L data ${out_disk}${data_partition}
