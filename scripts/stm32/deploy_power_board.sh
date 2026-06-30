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

DFU_VID_PID="0483:df11"

# Installed up front since dfu-util is also used below to detect the DFU
# device (this bot has no lsusb installed, so dfu-util -l is the check).
sudo apt install -y gcc-arm-none-eabi binutils-arm-none-eabi dfu-util

# Publish ENTER_BOOTLOADER_MODE command. jaiabot_power_board must already be
# running (and connected to /dev/power-board) for this to reach the MCU -
# it jumps to the STM32 ROM bootloader, which re-enumerates the board's USB
# port as a DFU device (0483:df11) instead of the CDC port (0483:5740).
echo "Sending ENTER_BOOTLOADER_MODE..."
# This script is copied to <build_dir>/share/jaiabot/stm32/power_board/uart/upload.sh,
# so prefer the freshly-built library sitting alongside it in <build_dir>/lib over the
# system package, which may predate this branch's message changes (e.g. mcu_command).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_BUILD_LIB="${SCRIPT_DIR}/../../../../../lib/libjaiabot_messages.so.1"
if [ -f "$DEV_BUILD_LIB" ]; then
    export GOBY_TOOL_LOAD_SHARED_LIBRARY="$(cd "$(dirname "$DEV_BUILD_LIB")" && pwd)/libjaiabot_messages.so.1"
else
    export GOBY_TOOL_LOAD_SHARED_LIBRARY=/usr/lib/aarch64-linux-gnu/libjaiabot_messages.so.1
fi
command="goby zeromq publish jaiabot_power_board::mcu_command jaiabot.protobuf.PowerBoardRequest 'time: $(date +%s%6N) mcu_command: ENTER_BOOTLOADER_MODE' --interprocess 'platform: \"${PLATFORM}\"'"
eval "$command"

# Give the publish a moment to actually reach the running jaiabot_power_board
# process (zeromq pub/sub has no delivery ack) before we stop that process.
sleep 1

# Stop the jaiabot_power_board service so it doesn't hold /dev/power-board
# (which is about to disappear and be replaced by the DFU device anyway).
echo "Stopping jaiabot services..."
sudo systemctl stop jaiabot_power_board

# The MCU only dispatches buffered commands (including ENTER_BOOTLOADER_MODE)
# once per main-loop iteration, and that loop sleeps ~10s per iteration on
# the LPTIM wake. Measured latency from publish to actual bootloader jump
# has been ~37s in practice (likely a couple of sleep cycles, not just one),
# so wait well past that with margin.
echo "Waiting for STM32 to enumerate as a DFU device (${DFU_VID_PID})..."
for i in $(seq 1 60); do
    if sudo dfu-util -l 2>/dev/null | grep -q "$DFU_VID_PID"; then
        break
    fi
    sleep 1
done

if ! sudo dfu-util -l 2>/dev/null | grep -q "$DFU_VID_PID"; then
    echo "ERROR: STM32 never enumerated as a DFU device (${DFU_VID_PID}). Is ENTER_BOOTLOADER_MODE handled by the firmware?"
    sudo systemctl restart jaiabot_power_board
    exit 1
fi

ELF="power_board.elf"
# Name of file to be created
BIN="power_board.bin"

echo "Converting ELF to BIN..."
arm-none-eabi-objcopy -O binary "$ELF" "$BIN"

echo "Flashing STM32 with dfu-util..."
if sudo dfu-util -d "$DFU_VID_PID" -a 0 -s 0x08000000:leave -D "$BIN"; then
    cp "$BIN" "power_board_uploaded.bin"
    cp "$ELF" "power_board_uploaded.elf"
    echo "Saved uploaded firmware as power_board_uploaded.{bin,elf}"
else
    echo "ERROR: Flash failed!"
    sudo systemctl restart jaiabot_power_board
    exit 1
fi

# The ROM bootloader's ":leave" jump back into the app doesn't always leave
# the USB peripheral in a state the app's own USB init re-enumerates
# cleanly from - in practice this has needed a physical USB
# unplug/replug (or full board power-cycle) before /dev/power-board comes
# back. Force an equivalent logical disconnect/reconnect here by bouncing
# the device's "authorized" sysfs attribute, so the host redoes a full
# enumeration instead of whatever partial state the ROM bootloader left.
echo "Forcing USB re-enumeration after DFU leave..."
sleep 2
for vendor_path in /sys/bus/usb/devices/*/idVendor; do
    devdir="$(dirname "$vendor_path")"
    if [ "$(cat "$vendor_path" 2>/dev/null)" = "0483" ]; then
        echo 0 | sudo tee "$devdir/authorized" > /dev/null
        sleep 1
        echo 1 | sudo tee "$devdir/authorized" > /dev/null
    fi
done
sleep 2

echo "Starting jaiabot_power_board service..."
sudo systemctl restart jaiabot_power_board
