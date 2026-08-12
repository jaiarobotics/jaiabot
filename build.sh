#!/bin/bash
# --- System Requirements Check ---
MIN_PROC=4
MIN_RAM_KB=3145728    # 3-4 GiB in KB
MIN_DISK_KB=10485760  # 10 GiB in KB
MEMORY_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
MEMORY_PER_PROCESS_KB="2000000"
AVAILABLE_DISK_KB=$(df --output=avail / | tail -1)
MEMORY_NPROC=$((MEMORY_KB / MEMORY_PER_PROCESS_KB))

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    echo "[INFO] JAIA_BUILD_NPROC not set, calculating automatically..."

    NPROC=$(nproc)

    if [ "${MEMORY_NPROC}" -gt "${NPROC}" ]; then
        JAIA_BUILD_NPROC=${NPROC}
    else
        JAIA_BUILD_NPROC=${MEMORY_NPROC}
    fi

    echo "[INFO] Auto nproc = ${JAIA_BUILD_NPROC}"
fi

echo "Detected system: $NPROC Processor(s), $(($MEMORY_KB / 1024)) MiB RAM, $((AVAILABLE_DISK_KB / 1024)) MiB free disk"

if [ "$NPROC" -lt "$MIN_PROC" ]; then
    echo "Warning: Your system has less than the required $MIN_PROC Processors to build the software."
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

# --- Generator selection: Ninja by default, pass --make to use GNU Make instead ---
GENERATOR=Ninja
args=()
for arg in "$@"; do
    if [ "${arg}" = "--make" ]; then
        GENERATOR="Unix Makefiles"
    else
        args+=("${arg}")
    fi
done
set -- "${args[@]}"

if [ "${GENERATOR}" = "Ninja" ] && ! command -v ninja > /dev/null; then
    echo "Error: ninja not found. Install it with 'jaia dev setup' (or scripts/build/setup-tools-build.sh), or pass --make to use GNU Make instead." >&2
    exit 1
fi

# Make sure we're using the nvm versions of npm and webpack
if [ -n "${XDG_CONFIG_HOME-}" ] && [ -d "${XDG_CONFIG_HOME}/nvm" ]; then
    export NVM_DIR="${XDG_CONFIG_HOME}/nvm"
elif [ -d "${HOME}/.nvm" ]; then
    export NVM_DIR="${HOME}/.nvm"
else
    echo "Error: Neither \$XDG_CONFIG_HOME/nvm nor \$HOME/.nvm exists." >&2
    exit 1
fi

source ${NVM_DIR}/nvm.sh

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

# Initialize and update submodules
git submodule update --init

echo "Configuring (generator: ${GENERATOR})..."
cd ${script_dir}/build/${ARCH}

# cmake refuses to reconfigure a directory that another generator wrote
if [ -f CMakeCache.txt ] && ! grep -q "^CMAKE_GENERATOR:INTERNAL=${GENERATOR}\$" CMakeCache.txt; then
    echo "Discarding the CMake cache left by a previous generator"
    rm -rf CMakeCache.txt CMakeFiles
fi

(set -x; cmake -G "${GENERATOR}" ${JAIABOT_CMAKE_FLAGS} ../..)
echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."
(set -x; time cmake --build . -- -j${JAIA_BUILD_NPROC} ${JAIABOT_MAKE_FLAGS} $@)
