#!/bin/bash
set -e -u

# Pinned versions — update these when upgrading the HAL/CMSIS/middlewares
HAL_DRIVER_VERSION="v1.13.6"
CMSIS_DEVICE_VERSION="v1.7.5"
CMSIS_CORE_VERSION="v5.4.0"
USB_DEVICE_VERSION="v2.11.5"

HAL_DRIVER_URL="https://github.com/STMicroelectronics/stm32l4xx_hal_driver/archive/refs/tags/${HAL_DRIVER_VERSION}.tar.gz"
CMSIS_DEVICE_URL="https://github.com/STMicroelectronics/cmsis_device_l4/archive/refs/tags/${CMSIS_DEVICE_VERSION}.tar.gz"
CMSIS_CORE_URL="https://github.com/STMicroelectronics/cmsis_core/archive/refs/tags/${CMSIS_CORE_VERSION}.tar.gz"
USB_DEVICE_URL="https://github.com/STMicroelectronics/stm32_mw_usb_device/archive/refs/tags/${USB_DEVICE_VERSION}.tar.gz"

script_dir=$(dirname "$0")
project_dir=$(realpath "${script_dir}/../..")
DRIVERS_DIR="${project_dir}/src/stm32/Drivers"
USB_DEVICE_DIR="${project_dir}/src/stm32/Middlewares/ST/STM32_USB_Device_Library"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
    FORCE=true
fi

# Key files that must exist for each complete component
DRIVERS_REQUIRED_FILES=(
    "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/Inc/stm32l4xx_hal.h"
    "${DRIVERS_DIR}/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal.c"
    "${DRIVERS_DIR}/CMSIS/Device/ST/STM32L4xx/Include/stm32l4xx.h"
    "${DRIVERS_DIR}/CMSIS/Include/core_cm4.h"
)
USB_DEVICE_REQUIRED_FILES=(
    "${USB_DEVICE_DIR}/Core/Inc/usbd_core.h"
    "${USB_DEVICE_DIR}/Core/Src/usbd_core.c"
    "${USB_DEVICE_DIR}/Class/CDC/Inc/usbd_cdc.h"
    "${USB_DEVICE_DIR}/Class/CDC/Src/usbd_cdc.c"
)

all_present() {
    for f in "$@"; do
        [ -f "$f" ] || return 1
    done
    return 0
}

# Usage: needs_fetch <dir> <required files...>; removes an incomplete dir
needs_fetch() {
    local dir="$1"
    shift
    if [ "$FORCE" = false ] && all_present "$@"; then
        return 1
    fi
    if [ -d "${dir}" ]; then
        echo "[STM32] ${dir#${project_dir}/} incomplete or --force, removing and re-downloading..."
        rm -rf "${dir}"
    fi
    return 0
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

if needs_fetch "${DRIVERS_DIR}" "${DRIVERS_REQUIRED_FILES[@]}"; then
    echo "[STM32] Downloading STM32L4 HAL/CMSIS drivers..."
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
else
    echo "[STM32] Drivers/ already present, skipping download. Use --force to re-download."
fi

# --- ST USB Device library (Core + CDC class), used by the power board ---
if needs_fetch "${USB_DEVICE_DIR}" "${USB_DEVICE_REQUIRED_FILES[@]}"; then
    echo "[STM32] Downloading STM32 USB Device library ${USB_DEVICE_VERSION}..."
    mkdir -p "${USB_DEVICE_DIR}/Class"
    curl -sL "${USB_DEVICE_URL}" | tar xz -C "${TMPDIR}"
    USB_DEVICE_EXTRACTED="${TMPDIR}/stm32-mw-usb-device-${USB_DEVICE_VERSION#v}"
    cp -r "${USB_DEVICE_EXTRACTED}/Core" "${USB_DEVICE_DIR}/"
    cp -r "${USB_DEVICE_EXTRACTED}/Class/CDC" "${USB_DEVICE_DIR}/Class/"
    cp "${USB_DEVICE_EXTRACTED}/LICENSE.md" "${USB_DEVICE_DIR}/" 2>/dev/null || true
    echo "[STM32] USB Device library downloaded successfully."
else
    echo "[STM32] Middlewares/ST/STM32_USB_Device_Library already present, skipping download."
fi
