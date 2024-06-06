#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

# Allow user to set nproc for their system, if desired
if [ -z "${JAIA_BUILD_NPROC}" ]; then
    MEMORY_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    MEMORY_PER_PROCESS_KB="2000000"
    MEMORY_NPROC=$((MEMORY_KB / MEMORY_PER_PROCESS_KB))
    NPROC=`nproc`

    if [ $MEMORY_NPROC -gt $NPROC ]; then
        JAIA_BUILD_NPROC=$NPROC
    else
        JAIA_BUILD_NPROC=$MEMORY_NPROC
    fi

    echo "Auto nproc = $JAIA_BUILD_NPROC"

fi

script_dir=$(dirname $0)

ARCH=$(dpkg --print-architecture)

# Make sure we're using the nvm versions of npm and webpack
source $HOME/.nvm/nvm.sh

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

echo "Configuring..."
cd ${script_dir}/build/${ARCH}
(set -x; cmake ../.. ${JAIABOT_CMAKE_FLAGS})
echo "Building with ${JAIA_BUILD_NPROC} parallel processes..."
(set -x; time cmake --build . -- -j${JAIA_BUILD_NPROC} ${JAIABOT_MAKE_FLAGS} $@)
