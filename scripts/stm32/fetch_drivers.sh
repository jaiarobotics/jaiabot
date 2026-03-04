#!/bin/bash
set -e -u

# Pinned versions — update these when upgrading the HAL/CMSIS
HAL_DRIVER_VERSION="v1.13.6"
CMSIS_DEVICE_VERSION="v1.7.5"
CMSIS_CORE_VERSION="v5.4.0"

HAL_DRIVER_URL="https://github.com/STMicroelectronics/stm32l4xx_hal_driver/archive/refs/tags/${HAL_DRIVER_VERSION}.tar.gz"
CMSIS_DEVICE_URL="https://github.com/STMicroelectronics/cmsis_device_l4/archive/refs/tags/${CMSIS_DEVICE_VERSION}.tar.gz"
CMSIS_CORE_URL="https://github.com/STMicroelectronics/cmsis_core/archive/refs/tags/${CMSIS_CORE_VERSION}.tar.gz"

script_dir=$(dirname "$0")
project_dir=$(realpath "${script_dir}/../..")
DRIVERS_DIR="${project_dir}/src/stm32/Drivers"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
    FORCE=true
fi

# Key files that must exist for a complete Drivers/ directory
REQUIRED_FILES=(
    "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/Inc/stm32l4xx_hal.h"
    "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal.c"
    "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx/Include/stm32l4xx.h"
    "${DRIVERS_DIR}/CMSIS/Include/core_cm4.h"
)

drivers_complete() {
    for f in "${REQUIRED_FILES[@]}"; do
        [ -f "$f" ] || return 1
    done
    return 0
}

if [ "$FORCE" = false ] && drivers_complete; then
    echo "[STM32] Drivers/ already present, skipping download. Use --force to re-download."
    exit 0
fi

# Clean up incomplete Drivers/ before downloading
if [ -d "${DRIVERS_DIR}" ] && ! drivers_complete; then
    echo "[STM32] Drivers/ incomplete, removing and re-downloading..."
    rm -rf "${DRIVERS_DIR}"
fi

echo "[STM32] Downloading STM32L4 HAL/CMSIS drivers..."

TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

mkdir -p "${DRIVERS_DIR}/STM32L4xx_HAL_Driver" "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx" "${DRIVERS_DIR}/CMSIS/Include"

# --- STM32L4xx HAL Driver ---
echo "[STM32]   HAL Driver ${HAL_DRIVER_VERSION}..."
curl -sL "${HAL_DRIVER_URL}" | tar xz -C "${TMPDIR}"
HAL_EXTRACTED="${TMPDIR}/stm32l4xx-hal-driver-${HAL_DRIVER_VERSION#v}"
cp -r "${HAL_EXTRACTED}/Inc" "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/"
cp -r "${HAL_EXTRACTED}/Src" "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/"

# --- CMSIS Device (STM32L4xx headers + system source) ---
echo "[STM32]   CMSIS Device ${CMSIS_DEVICE_VERSION}..."
curl -sL "${CMSIS_DEVICE_URL}" | tar xz -C "${TMPDIR}"
CMSIS_DEV_EXTRACTED="${TMPDIR}/cmsis-device-l4-${CMSIS_DEVICE_VERSION#v}"
cp -r "${CMSIS_DEV_EXTRACTED}/Include" "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx/"
cp -r "${CMSIS_DEV_EXTRACTED}/Source" "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx/"
# Copy license files
cp "${CMSIS_DEV_EXTRACTED}/LICENSE.md" "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx/" 2>/dev/null || true

# --- CMSIS Core (ARM core headers: core_cm4.h, cmsis_gcc.h, etc.) ---
echo "[STM32]   CMSIS Core ${CMSIS_CORE_VERSION}..."
curl -sL "${CMSIS_CORE_URL}" | tar xz -C "${TMPDIR}"
CMSIS_CORE_EXTRACTED="${TMPDIR}/cmsis-core-${CMSIS_CORE_VERSION#v}"
cp -r "${CMSIS_CORE_EXTRACTED}/Include/"* "${DRIVERS_DIR}/CMSIS/Include/"
cp "${CMSIS_CORE_EXTRACTED}/LICENSE.txt" "${DRIVERS_DIR}/CMSIS/" 2>/dev/null || true

echo "[STM32] Drivers downloaded successfully."