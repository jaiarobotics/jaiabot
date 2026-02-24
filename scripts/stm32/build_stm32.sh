#!/bin/bash
set -e -u

script_dir=$(dirname "$0")
project_dir=$(realpath "${script_dir}/..")

STM32_SRC_DIR="${project_dir}/src/stm32"
STM32_BUILD_DIR="${project_dir}/build/stm32"
MESSAGES_DIR="${project_dir}/src/lib/messages"
NANOPB_GEN_DIR="${STM32_BUILD_DIR}/nanopb/jaiabot"
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

# --- Optional: regenerate HAL/CMSIS from .ioc ---
if [ "$REGEN" = true ]; then
    echo "[STM32] Regenerating HAL/CMSIS from .ioc..."
    bash "${script_dir}/regen_ioc.sh"
fi

# --- Clean ---
if [ "$CLEAN" = true ]; then
    echo "[STM32] Cleaning STM32 build artifacts..."
    rm -rf "${STM32_BUILD_DIR}"
    make -C "${STM32_SRC_DIR}" clean 2>/dev/null || true
fi

mkdir -p "${STM32_BUILD_DIR}"
mkdir -p "${NANOPB_GEN_DIR}"

# --- Generate nanopb sources from .proto files ---
echo "[STM32] Generating nanopb sources from .proto + .options files..."
nanopb_generator.py \
    --output-dir="${NANOPB_GEN_DIR}" \
    --options-path="${MESSAGES_DIR}" \
    "${MESSAGES_DIR}"/*.proto

echo "[STM32] Generated nanopb files:"
ls "${NANOPB_GEN_DIR}"

# --- Build ---
echo "[STM32] Building STM32L432 firmware..."
(set -x; time make -C "${STM32_SRC_DIR}" \
    -j"$(nproc)" \
    BUILD_DIR="${STM32_BUILD_DIR}" \
    NANOPB_GEN_DIR="${NANOPB_GEN_DIR}" \
    MESSAGES_DIR="${MESSAGES_DIR}")

# --- Verify output ---
if [ ! -f "${STM32_BUILD_DIR}/firmware.hex" ]; then
    echo "[STM32] ERROR: firmware.hex not found after build. Something went wrong."
    exit 1
fi

# --- Report size ---
if command -v arm-none-eabi-size &>/dev/null && [ -f "${STM32_BUILD_DIR}/firmware.elf" ]; then
    echo "[STM32] Firmware size:"
    arm-none-eabi-size "${STM32_BUILD_DIR}/firmware.elf"
fi

# --- Save hash ---
echo "$CURRENT_HASH" > "$HASH_FILE"

echo "[STM32] Build complete: ${STM32_BUILD_DIR}/firmware.hex"