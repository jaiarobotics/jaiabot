#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    echo "[INFO] JAIA_BUILD_NPROC not set, calculating automatically..."

    MEMORY_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    MEMORY_PER_PROCESS_KB="2000000"

    echo "[DEBUG] MemAvailable: ${MEMORY_KB} KB"
    echo "[DEBUG] Memory per process: ${MEMORY_PER_PROCESS_KB} KB"

    if [ -z "${MEMORY_KB}" ]; then
        echo "[WARN] Unable to read memory info, defaulting to 1 process."
        MEMORY_NPROC=1
    else
        MEMORY_NPROC=$((MEMORY_KB / MEMORY_PER_PROCESS_KB))
    fi

    NPROC=$(nproc)
    echo "[DEBUG] Detected CPU cores: ${NPROC}"

    if [ "${MEMORY_NPROC}" -gt "${NPROC}" ]; then
        JAIA_BUILD_NPROC=${NPROC}
    else
        JAIA_BUILD_NPROC=${MEMORY_NPROC}
    fi

    # Prevent 0 or negative value
    if [ "${JAIA_BUILD_NPROC}" -le 0 ]; then
        echo "[WARN] Calculated JAIA_BUILD_NPROC=${JAIA_BUILD_NPROC}, defaulting to 1"
        JAIA_BUILD_NPROC=1
    fi

    echo "[INFO] Auto nproc = ${JAIA_BUILD_NPROC}"
fi


# --- System Requirements Check ---
MIN_CPUS=4
MIN_RAM_KB=3145728    # 3-4 GiB in KB
MIN_DISK_KB=10485760  # 10 GiB in KB

AVAILABLE_DISK_KB=$(df --output=avail / | tail -1)

echo "Detected system: $AVAILABLE_CPUS CPU(s), $((AVAILABLE_RAM_KB / 1024)) MiB RAM, $((AVAILABLE_DISK_KB / 1024)) MiB free disk"

if [ "$NPROC" -lt "$MIN_CPUS" ]; then
    echo "Warning: Your system has less than the required $MIN_CPUS CPUs to build the software."
fi

if [ "$MEMORY_KB" -lt "$MIN_RAM_KB" ]; then
    echo "Warning: Your system has less than the required 4 GiB of RAM."
fi

if [ "$AVAILABLE_DISK_KB" -lt "$MIN_DISK_KB" ]; then
    echo "Warning: Your system has less than the required 10 GiB of disk space."
fi

# Catch corner case where parallelism resolves to 0
if [ "$JAIA_BUILD_NPROC" -le 0 ]; then
    echo "Error: JAIA_BUILD_NPROC resolved to 0. Your system does not meet the minimum requirements to build this software."
    exit 1
fi

script_dir=$(dirname $0)

ARCH=$(dpkg --print-architecture)

# Make sure we're using the nvm versions of npm and webpack
if [ -z "${XDG_CONFIG_HOME-}" ]; then
    export NVM_DIR="${HOME}/.nvm"
else
    export NVM_DIR="${XDG_CONFIG_HOME}/nvm"
fi

source ${NVM_DIR}/nvm.sh

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

# Initialize and update submodules
git submodule update --init

echo "Configuring..."
cd ${script_dir}/build/${ARCH}
(set -x; cmake ${JAIABOT_CMAKE_FLAGS} ../..)
echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."
(set -x; time cmake --build . -- -j${JAIA_BUILD_NPROC} ${JAIABOT_MAKE_FLAGS} $@)
