#!/bin/bash

# The spi group is referenced by /etc/udev/rules.d/90-jaiabot_spi.rules
groupadd -f spi
usermod -aG spi jaia

if ls /dev/spidev* > /dev/null 2>&1; then
    # Apply the udev rule to devices that already exist
    udevadm trigger --subsystem-match=spidev
else
    echo "Warning: no /dev/spidev* found (this is OK if SPI is not enabled or running in Virtualbox)"
fi
