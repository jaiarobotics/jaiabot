#!/bin/bash

# Exit immediately if a command exits with non-zero status
set -e

# Publish ENTER_BOOTLOADER_MODE command
export GOBY_TOOL_LOAD_SHARED_LIBRARY=/usr/lib/aarch64-linux-gnu/libjaiabot_messages.so.1
command="goby zeromq publish jaiabot_sensors::mcu_command  jaiabot.sensor.protobuf.SensorRequest 'time: 0 mcu_command: ENTER_BOOTLOADER_MODE' --interprocess 'platform: \"bot2_fleet0\"'"
eval "$command"
sleep 1

# Stop the jaiabot services to prevent Arduino 
# from binding to /dev/ttyUSB0
echo "Stopping jaiabot services..."
sudo systemctl stop jaiabot

# Build stm32flash-0.7 directory
echo "Build stm32flash-0.7 directory..."
tar -xvzf stm32flash-0.7.tar.gz    
cd stm32flash-0.7
make 
cd ..

# Install required packages for deploy
sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi

ELF="JAIA_BIO-PAYLOAD.elf"
# Name of file to be created
BIN="JAIA_BIO-PAYLOAD.bin"

echo "Converting ELF to BIN..."
arm-none-eabi-objcopy -O binary "$ELF" "$BIN"

echo "Resetting STM32..."
echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3
echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3

stm32flash-0.7/stm32flash -w JAIA_BIO-PAYLOAD.bin -v -b "115200" -g "0x08000000"  "/dev/ttyUSB0"

echo "Resetting STM32..."
echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3
echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3

echo "Starting jaiabot services..."
sudo systemctl start jaiabot
