#!/bin/bash

# Enables I2C bus 0 (/dev/i2c-0, GPIO 0/1) on the Raspberry Pi by adding
# dtparam=i2c_vc=on to the firmware config.txt. Safe to run repeatedly.
# Changes take effect after the next reboot.

CONFIG=/boot/firmware/config.txt
LINE="dtparam=i2c_vc=on"

if [ "$EUID" -ne 0 ]
  then echo "Must be root to run this script"
  exit 1
fi

# Not a Raspberry Pi (e.g. simulation or VirtualFleet), nothing to do
if [ ! -f "$CONFIG" ]; then
    echo "$CONFIG not found, skipping I2C bus 0 configuration"
    exit 0
fi

if grep -q "^${LINE}" "$CONFIG"; then
    echo "I2C bus 0 already enabled in $CONFIG"
    exit 0
fi

# [all] ensures the line isn't scoped to a preceding conditional section (e.g. [cm4])
cat >> "$CONFIG" <<EOF

# jaiabot: enable I2C bus 0
[all]
${LINE}
EOF

echo "Enabled I2C bus 0 in $CONFIG (reboot required to take effect)"
