#!/bin/bash

# Exit immediately if a command exits with non-zero status
set -e

# Load system configuration to get bot and fleet IDs
if [ -f "/etc/jaiabot/runtime.env" ]; then
    source /etc/jaiabot/runtime.env
else
    echo "ERROR: /etc/jaiabot/runtime.env not found"
    exit 1
fi

# Construct platform name dynamically from bot and fleet indices
PLATFORM="bot${jaia_bot_index}_fleet${jaia_fleet_index}"

# Publish ENTER_BOOTLOADER_MODE command
export GOBY_TOOL_LOAD_SHARED_LIBRARY=/usr/lib/aarch64-linux-gnu/libjaiabot_messages.so.1
command="goby zeromq publish jaiabot_sensors::mcu_command  jaiabot.sensor.protobuf.SensorRequest 'time: 0 mcu_command: ENTER_BOOTLOADER_MODE' --interprocess 'platform: \"${PLATFORM}\"'"
eval "$command"
sleep 1

# Stop the jaiabot_sensors service to prevent stray data from going across the line 
echo "Stopping jaiabot services..."
sudo systemctl stop jaiabot_sensors

# Build stm32flash-0.7 directory
echo "Build stm32flash-0.7 directory..."
tar -xvzf stm32flash-0.7.tar.gz    
cd stm32flash-0.7
make 
cd ..

# Install required packages for deploy
sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi

ELF="bio_payload.elf"
# Name of file to be created
BIN="bio_payload.bin"

echo "Converting ELF to BIN..."
arm-none-eabi-objcopy -O binary "$ELF" "$BIN"

echo "Resetting STM32..."
echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3
echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3


echo "Flashing STM32 with stm32flash..."
if stm32flash-0.7/stm32flash -w "$BIN" -v -b "115200" -g "0x08000000" "/dev/bio-payload"; then
    cp "$BIN" "bio_payload_uploaded.bin"
    cp "$ELF" "bio_payload_uploaded.elf"
    echo "Saved uploaded firmware as bio_payload_uploaded.{bin,elf}"
else
    echo "ERROR: Flash failed!"
    sudo systemctl restart jaiabot_sensors
    exit 1
fi

echo "Resetting STM32..."
echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3
echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized
sleep 3

echo "Starting jaiabot_sensors service..."
sudo systemctl restart jaiabot_sensors
