#!/bin/bash

set -u -e


if [ ! $# -eq 2 ]; then
   echo "Usage $0 /dev/sdX images/jaiabot__rpicam-zero-trixie.img[.gz]"
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


img_ext="${img##*.}"
echo "$img_ext"
sudo umount ${out_disk}? || true

if [ "$img_ext" = "gz" ]; then
    gunzip -c $img | sudo dd of=$out_disk status=progress bs=10M
elif [ "$img_ext" = "img" ]; then
    sudo dd if=$img of=$out_disk status=progress bs=10M
else
    echo "$img must be gzipped (.gz) or raw img (.img)"
    exit 1
fi


sleep 5
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
echo t    # Change type
echo 3    # Partition number 3
echo 07   # exFAT/NTFS
echo w    # Write changes
) | sudo fdisk $out_disk

sudo partprobe $out_disk
sudo mkfs.exfat -n data ${out_disk}${data_partition}
