#!/bin/bash

# Build the bio payload STM32 firmware locally and flash it onto one or more bots
# over SSH, without needing an ARM toolchain (or a checkout) on the Pi.
#
# The existing scripts/stm32/deploy_bio_payload.sh runs *on* the Pi and installs
# gcc-arm-none-eabi/binutils-arm-none-eabi there just to run objcopy on the ELF.
# The CubeMX Makefile already emits bio_payload.bin next to the ELF, so that step
# can happen here instead and the Pi never needs the cross toolchain.
#
# stm32flash still has to run on the Pi -- it drives the STM32 UART bootloader over
# the physical /dev/bio-payload port -- so it is compiled there once and cached in
# the staging directory for subsequent deploys. That needs only gcc/make, which the
# bot image already carries.
#
# Usage:
#   ./scripts/stm32/remote_deploy_bio_payload.sh 172.20.11.102 [more hosts ...]
#
# Options:
#   --user USER      SSH user on the bot (default: jaia)
#   --skip-build     Flash the existing build/stm32/bio_payload.bin, don't rebuild
#   --force          Rebuild even if the source hash is unchanged
#   --clean          Wipe build/stm32 and rebuild from scratch
#   --port DEV       Serial port on the bot (default: /dev/bio-payload)
#   --baud N         Bootloader baud rate (default: 115200)
#   --rebuild-tool   Force stm32flash to be recompiled on the bot

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(realpath "${script_dir}/../..")

SSH_USER="jaia"
SERIAL_PORT="/dev/bio-payload"
BAUD="115200"
REMOTE_STAGE_DIR='$HOME/.cache/jaiabot/stm32-deploy/bio_payload'
SKIP_BUILD=false
REBUILD_TOOL=false
BUILD_FLAGS=()
TARGETS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user)         SSH_USER="$2"; shift 2 ;;
        --port)         SERIAL_PORT="$2"; shift 2 ;;
        --baud)         BAUD="$2"; shift 2 ;;
        --skip-build)   SKIP_BUILD=true; shift ;;
        --rebuild-tool) REBUILD_TOOL=true; shift ;;
        --force)        BUILD_FLAGS+=(--force); shift ;;
        --clean)        BUILD_FLAGS+=(--clean); shift ;;
        -h|--help)      awk 'NR>2 && /^#/{sub(/^# ?/,""); print; next} NR>2{exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
        -*)             echo "❌ Unknown option: $1" >&2; exit 1 ;;
        *)              TARGETS+=("$1"); shift ;;
    esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
    echo "❌ No targets given." >&2
    echo "   Usage: $0 [options] <bot-host> [more hosts ...]" >&2
    echo "   e.g.   $0 172.20.11.102" >&2
    exit 1
fi

STM32_BUILD_DIR="${project_dir}/build/stm32"
FIRMWARE_BIN="${STM32_BUILD_DIR}/bio_payload.bin"
FIRMWARE_ELF="${STM32_BUILD_DIR}/bio_payload.elf"
STM32FLASH_TARBALL="${script_dir}/stm32flash-0.7.tar.gz"

# ---------------------------------------------------------------- local build

if [[ "${SKIP_BUILD}" == false ]]; then
    echo "🟢 Building bio_payload firmware locally"
    # build_bio_payload_package.sh checks the toolchain, regenerates nanopb sources
    # and short-circuits when no source file has changed (unless --force/--clean).
    bash "${script_dir}/build_bio_payload_package.sh" ${BUILD_FLAGS[@]+"${BUILD_FLAGS[@]}"}
else
    echo "🟡 Skipping build (--skip-build)"
fi

# The Makefile's "all" target emits .elf, .hex and .bin together, so the .bin is
# normally already here. Regenerate it if only an ELF survived (e.g. a partial build).
if [[ ! -f "${FIRMWARE_BIN}" ]]; then
    if [[ -f "${FIRMWARE_ELF}" ]] && command -v arm-none-eabi-objcopy >/dev/null 2>&1; then
        echo "🟡 ${FIRMWARE_BIN##*/} missing, regenerating from the ELF"
        arm-none-eabi-objcopy -O binary -S "${FIRMWARE_ELF}" "${FIRMWARE_BIN}"
    else
        echo "❌ ${FIRMWARE_BIN} not found. Build first (drop --skip-build)." >&2
        exit 1
    fi
fi

if [[ ! -f "${STM32FLASH_TARBALL}" ]]; then
    echo "❌ ${STM32FLASH_TARBALL} not found." >&2
    exit 1
fi

echo "✅ Firmware ready: ${FIRMWARE_BIN} ($(stat -c %s "${FIRMWARE_BIN}") bytes)"
if command -v arm-none-eabi-size >/dev/null 2>&1 && [[ -f "${FIRMWARE_ELF}" ]]; then
    arm-none-eabi-size "${FIRMWARE_ELF}"
fi

# --------------------------------------------------------------- remote flash

failed=()

for remote in "${TARGETS[@]}"; do
    echo
    echo "🟢 Deploying to ${SSH_USER}@${remote}"

    if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "${SSH_USER}@${remote}" true 2>/dev/null; then
        echo "❌ Cannot SSH to ${SSH_USER}@${remote} (need key-based auth)." >&2
        failed+=("${remote}")
        continue
    fi

    if ! stage_dir=$(ssh "${SSH_USER}@${remote}" \
            "mkdir -p ${REMOTE_STAGE_DIR} && cd ${REMOTE_STAGE_DIR} && pwd"); then
        echo "❌ Could not create the staging directory on ${remote}." >&2
        failed+=("${remote}")
        continue
    fi

    echo "   ↳ staging in ${stage_dir}"
    if ! rsync -z --checksum "${FIRMWARE_BIN}" "${STM32FLASH_TARBALL}" \
            "${SSH_USER}@${remote}:${stage_dir}/"; then
        echo "❌ Could not copy the firmware to ${remote}." >&2
        failed+=("${remote}")
        continue
    fi

    # The remote half runs from a quoted heredoc so nothing expands locally;
    # everything it needs arrives as a positional argument.
    if ssh "${SSH_USER}@${remote}" bash -s -- \
            "${stage_dir}" "${SERIAL_PORT}" "${BAUD}" "${REBUILD_TOOL}" <<'REMOTE_EOF'
set -euo pipefail

STAGE_DIR="$1"
SERIAL_PORT="$2"
BAUD="$3"
REBUILD_TOOL="$4"

cd "${STAGE_DIR}"

if [ ! -f /etc/jaiabot/runtime.env ]; then
    echo "❌ /etc/jaiabot/runtime.env not found -- is this a configured bot?" >&2
    exit 1
fi
# shellcheck disable=SC1091
source /etc/jaiabot/runtime.env
PLATFORM="bot${jaia_bot_index}_fleet${jaia_fleet_index}"
echo "   platform: ${PLATFORM}"

# stm32flash is an arm64 binary talking to the physical UART, so it is built here
# rather than cross-compiled. Cached across deploys: this costs a few seconds once.
if [ "${REBUILD_TOOL}" = "true" ] || [ ! -x stm32flash-0.7/stm32flash ]; then
    echo "   building stm32flash (one-time)"
    rm -rf stm32flash-0.7
    tar -xzf stm32flash-0.7.tar.gz
    make -C stm32flash-0.7 >/dev/null
fi

# The STM32 has no BOOT0 strap wired out, so the only way into the system
# bootloader is the firmware's own jumpToBootloader(). That command is relayed by
# jaiabot_sensors, which therefore has to still be running at this point -- the
# service is stopped immediately afterwards so it cannot talk over the flash.
if ! systemctl is-active --quiet jaiabot_sensors; then
    echo "❌ jaiabot_sensors is not running." >&2
    echo "   It relays ENTER_BOOTLOADER_MODE to the payload board, so it must be up" >&2
    echo "   before flashing. Start it with: sudo systemctl start jaiabot_sensors" >&2
    exit 1
fi

echo "   commanding payload board into bootloader mode"
export GOBY_TOOL_LOAD_SHARED_LIBRARY="${GOBY_TOOL_LOAD_SHARED_LIBRARY:-/usr/lib/aarch64-linux-gnu/libjaiabot_messages.so.1}"
goby zeromq publish jaiabot_sensors::mcu_command \
    jaiabot.sensor.protobuf.SensorRequest 'time: 0 mcu_command: ENTER_BOOTLOADER_MODE' \
    --interprocess "platform: \"${PLATFORM}\""
sleep 1

echo "   stopping jaiabot_sensors"
sudo systemctl stop jaiabot_sensors

# However this exits from here on, bring the service back up.
restart_sensors() { echo "   restarting jaiabot_sensors"; sudo systemctl restart jaiabot_sensors; }
trap restart_sensors EXIT

reset_board() {
    # The BIO payload board enumerates on bus 1 of the Pi 4; re-authorizing the bus
    # re-enumerates its USB serial adapter.
    echo '0' | sudo tee /sys/bus/usb/devices/usb1/authorized >/dev/null
    sleep 3
    echo '1' | sudo tee /sys/bus/usb/devices/usb1/authorized >/dev/null
    sleep 3
}

echo "   resetting board"
reset_board

echo "   flashing ${SERIAL_PORT} @ ${BAUD}"
if ! stm32flash-0.7/stm32flash -w bio_payload.bin -v -b "${BAUD}" -g "0x08000000" "${SERIAL_PORT}"; then
    echo "❌ Flash failed" >&2
    exit 1
fi

cp bio_payload.bin bio_payload_uploaded.bin
echo "   saved bio_payload_uploaded.bin for reference"

echo "   resetting board"
reset_board

echo "✅ Flashed successfully"
REMOTE_EOF
    then
        echo "✅ ${remote} done"
    else
        echo "❌ ${remote} failed" >&2
        failed+=("${remote}")
    fi
done

echo
if [[ ${#failed[@]} -gt 0 ]]; then
    echo "❌ Failed on: ${failed[*]}" >&2
    exit 1
fi
echo "✅ All targets flashed"
