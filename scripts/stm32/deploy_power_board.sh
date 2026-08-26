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

POWER_BOARD_DEVICE=/dev/power-board
if [ ! -e "$POWER_BOARD_DEVICE" ]; then
    for device in /dev/serial/by-id/usb-STMicroelectronics_STM32_Virtual_ComPort_*; do
        if [ -e "$device" ] && udevadm info -q property -n "$device" 2>/dev/null |
            grep -q '^ID_VENDOR_ID=0483$' &&
            udevadm info -q property -n "$device" 2>/dev/null | grep -q '^ID_MODEL_ID=5740$'; then
            sudo ln -sfn "$device" "$POWER_BOARD_DEVICE"
            break
        fi
    done
fi

if [ ! -e "$POWER_BOARD_DEVICE" ]; then
    echo "ERROR: STM32 CDC device not found; cannot create $POWER_BOARD_DEVICE."
    exit 1
fi

if ! systemctl is-active --quiet jaiabot_power_board; then
    sudo systemctl start jaiabot_power_board
fi

for attempt in $(seq 1 30); do
    if systemctl is-active --quiet jaiabot_power_board && [ -e "$POWER_BOARD_DEVICE" ]; then
        sleep 1
        break
    fi
    sleep 1
done

if ! systemctl is-active --quiet jaiabot_power_board; then
    echo "ERROR: jaiabot_power_board did not become active."
    exit 1
fi

# Publish ENTER_BOOTLOADER_MODE command. jaiabot_power_board must already be
# running (and connected to /dev/power-board) for this to reach the MCU -
# it jumps to the STM32 ROM bootloader, which re-enumerates the board's USB
# port as a DFU device (0483:df11) instead of the CDC port (0483:5740).
echo "Sending ENTER_BOOTLOADER_MODE..."
# This script is copied to <build_dir>/share/jaiabot/stm32/power_board/uart/upload.sh,
# so prefer the freshly-built library sitting alongside it in <build_dir>/lib over the
# system package, which may predate this branch's message changes (e.g. mcu_command).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_CANDIDATES=(
    "${SCRIPT_DIR}/../../build/noble-2.y-arm64/lib/libjaiabot_messages.so.1"
    "${SCRIPT_DIR}/../../build/amd64/lib/libjaiabot_messages.so.1"
    "${SCRIPT_DIR}/../../../../../lib/libjaiabot_messages.so.1"
    "/usr/lib/aarch64-linux-gnu/libjaiabot_messages.so.1"
)

for candidate in "${LIB_CANDIDATES[@]}"; do
    if [ -f "$candidate" ]; then
        export GOBY_TOOL_LOAD_SHARED_LIBRARY="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
        break
    fi
done

if [ -z "${GOBY_TOOL_LOAD_SHARED_LIBRARY:-}" ]; then
    echo "ERROR: libjaiabot_messages.so.1 not found in the build or installed library paths."
    exit 1
fi

# Goby's publish command remains alive after publishing while it services the
# middleware connection, so bound each invocation before continuing.
for attempt in $(seq 1 5); do
    timeout 2s goby zeromq publish \
        jaiabot_power_board::mcu_command \
        jaiabot.protobuf.PowerBoardRequest \
        "time: $(date +%s%6N) power_board_mcu_command: ENTER_BOOTLOADER_MODE" \
        --interprocess "platform: \"${PLATFORM}\"" || publish_status=$?
    if [ "${publish_status:-0}" -ne 0 ] && [ "${publish_status}" -ne 124 ]; then
        echo "ERROR: failed to publish ENTER_BOOTLOADER_MODE (status ${publish_status})."
        exit "${publish_status}"
    fi
    unset publish_status
    sleep 1
done

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
