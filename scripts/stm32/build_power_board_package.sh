#!/bin/bash
set -e -u

script_dir=$(dirname "$0")
project_dir=$(realpath "${script_dir}/../..")

STM32_SRC_DIR="${project_dir}/src/stm32"
STM32_BOARD_DIR="${STM32_SRC_DIR}/power_board"
STM32_BUILD_DIR="${project_dir}/build/stm32"
MESSAGES_DIR="${project_dir}/src/lib/messages"
HASH_FILE="${STM32_BUILD_DIR}/.last_build_hash"

# --- Argument parsing ---
CLEAN=false
REGEN=false
FORCE=false
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --clean) CLEAN=true ;;
        --regen) REGEN=true ;;
        --force) FORCE=true ;;
        *) echo "[STM32] Unknown argument: $1"; exit 1 ;;
    esac
    shift
done

# --- Toolchain check ---
if ! command -v arm-none-eabi-gcc &>/dev/null; then
    echo "[STM32] ERROR: arm-none-eabi-gcc not found."
    echo "  Run: bash ${script_dir}/setup_tools_build.sh"
    exit 1
fi

if ! command -v nanopb_generator.py &>/dev/null; then
    echo "[STM32] ERROR: nanopb_generator.py not found."
    echo "  Run: bash ${script_dir}/setup_tools_build.sh"
    exit 1
fi

# --- Change detection ---
# Hash all source files that affect the STM32 build:
# - STM32 C source/headers
# - .ioc file
# - .proto and .options files (changing these changes generated nanopb output)
# - nanopb runtime files
CURRENT_HASH=$(find \
    "${STM32_SRC_DIR}" \
    "${MESSAGES_DIR}" \
    -type f \( \
        -name "*.c" -o \
        -name "*.h" -o \
        -name "*.ioc" -o \
        -name "*.proto" -o \
        -name "*.options" \
    \) \
    | sort | xargs sha256sum 2>/dev/null | sha256sum | awk '{print $1}')

if [ "$FORCE" = false ] && [ "$CLEAN" = false ]; then
    if [ -f "$HASH_FILE" ] && [ "$(cat "$HASH_FILE")" = "$CURRENT_HASH" ]; then
        echo "[STM32] No source changes detected, skipping build. Use --force to override."
        exit 0
    fi
fi

# --- Fetch Drivers (HAL/CMSIS) if not present ---
FETCH_FLAGS=""
if [ "$REGEN" = true ]; then
    FETCH_FLAGS="--force"
fi
bash "${script_dir}/fetch_drivers.sh" ${FETCH_FLAGS}

# --- Clean ---
if [ "$CLEAN" = true ]; then
    echo "[STM32] Cleaning STM32 build artifacts..."
    rm -rf "${STM32_BUILD_DIR}"
    make -C "${STM32_BOARD_DIR}" clean 2>/dev/null || true
fi

mkdir -p "${STM32_BUILD_DIR}"

# --- Stubs for non-embedded dependencies ---
# DCCL option annotations are Linux-side only; nanopb doesn't use them on STM32.
# The generated pb.h files include dccl/option_extensions.pb.h, so we provide
# an empty stub. JAIABOT_INC=${STM32_BUILD_DIR} puts this on the include path.
mkdir -p "${STM32_BUILD_DIR}/dccl"
cat > "${STM32_BUILD_DIR}/dccl/option_extensions.pb.h" << 'EOF'
/* Stub: DCCL option extensions are not used in nanopb embedded builds */
#ifndef DCCL_OPTION_EXTENSIONS_PB_H
#define DCCL_OPTION_EXTENSIONS_PB_H
#endif
EOF

# --- Set up proto staging dir so "jaiabot/messages/*.proto" imports resolve ---
PROTO_STAGING="${STM32_BUILD_DIR}/proto_staging"
mkdir -p "${PROTO_STAGING}/jaiabot"
ln -sfn "${MESSAGES_DIR}" "${PROTO_STAGING}/jaiabot/messages"

NANOPB_OUT="${STM32_BUILD_DIR}/nanopb"
NANOPB_MSG_DIR="${NANOPB_OUT}/jaiabot/messages"
NANOPB_SENSOR_DIR="${NANOPB_MSG_DIR}/sensor"
NANOPB_POWER_BOARD_DIR="${NANOPB_MSG_DIR}/power_board"
mkdir -p "${NANOPB_MSG_DIR}"
mkdir -p "${NANOPB_SENSOR_DIR}"
mkdir -p "${NANOPB_POWER_BOARD_DIR}"

# --- Generate nanopb sources from .proto files ---
echo "[STM32] Generating nanopb sources..."
# Top-level messages
nanopb_generator.py \
    --output-dir="${NANOPB_MSG_DIR}" \
    --options-path="${MESSAGES_DIR}" \
    -I "${PROTO_STAGING}" \
    "${MESSAGES_DIR}"/*.proto 2>&1 | grep -v '^Writing to\|warning:' || true

# Sensor messages — pass via staging symlink so protoc sees them as
# "jaiabot/messages/sensor/..." (matching the fully-qualified imports in the protos).
# Use NANOPB_OUT (not NANOPB_SENSOR_DIR) as --output-dir: nanopb appends the proto's
# path relative to the -I root (jaiabot/messages/sensor/) automatically, so using
# NANOPB_SENSOR_DIR would produce a doubly-nested output path.
nanopb_generator.py \
    --output-dir="${NANOPB_OUT}" \
    --options-path="${MESSAGES_DIR}/sensor" \
    -I "${PROTO_STAGING}" \
    "${PROTO_STAGING}/jaiabot/messages/sensor"/*.proto 2>&1 | grep -v '^Writing to\|warning:' || true

# Power board messages — same pattern as sensor above.
nanopb_generator.py \
    --output-dir="${NANOPB_OUT}" \
    --options-path="${MESSAGES_DIR}/power_board" \
    -I "${PROTO_STAGING}" \
    "${PROTO_STAGING}/jaiabot/messages/power_board"/*.proto 2>&1 | grep -v '^Writing to\|warning:' || true

# --- Build ---
# NANOPB_INC: root of jaiabot/messages/ tree → NANOPB_SENSOR_GEN_DIR = $(NANOPB_INC)/jaiabot/messages/sensor
# JAIABOT_INC: parent of nanopb/ → resolves #include "nanopb/jaiabot/messages/sensor/..."
# NANOPB_SYS_INC: sensor dir → resolves bare sibling includes inside sensor pb.h files
echo "[STM32] Building power_board (STM32L433) firmware..."
make -C "${STM32_BOARD_DIR}" \
    -j"$(nproc)" \
    BUILD_DIR="${STM32_BUILD_DIR}" \
    JAIABOT_INC="${STM32_BUILD_DIR}" \
    NANOPB_INC="${NANOPB_OUT}" \
    NANOPB_SYS_INC="${NANOPB_SENSOR_DIR}" \
    --no-print-directory -s

# --- Verify output ---
FIRMWARE_HEX="${STM32_BUILD_DIR}/power_board.hex"
FIRMWARE_ELF="${STM32_BUILD_DIR}/power_board.elf"

if [ ! -f "${FIRMWARE_HEX}" ]; then
    echo "[STM32] ERROR: ${FIRMWARE_HEX} not found after build. Something went wrong."
    exit 1
fi

# --- Report size ---
if command -v arm-none-eabi-size &>/dev/null && [ -f "${FIRMWARE_ELF}" ]; then
    echo "[STM32] Firmware size:"
    arm-none-eabi-size "${FIRMWARE_ELF}"
fi

# --- Save hash ---
echo "$CURRENT_HASH" > "$HASH_FILE"

echo "[STM32] Build complete: ${FIRMWARE_HEX}"