#!/bin/bash

# The BIO payload board connects to bus 1 on the Raspberry Pi 4 because of its USB properties
echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 1
echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 1
