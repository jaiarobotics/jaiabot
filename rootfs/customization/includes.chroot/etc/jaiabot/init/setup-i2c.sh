#!/bin/bash

if [ -e /dev/i2c-1 ]; then
    groupadd -f i2c
    chown :i2c /dev/i2c-1
    chmod g+rw /dev/i2c-1
    usermod -aG i2c jaia
    udev_entry='KERNEL=="i2c-[0-9]*", GROUP="i2c"'
    grep "$udev_entry" /etc/udev/rules.d/10-local_i2c_group.rules || echo "$udev_entry" >> /etc/udev/rules.d/10-local_i2c_group.rules
else
    echo "Warning: no /dev/i2c-1 found so not configuring (this is OK if running in Virtualbox)"
fi

