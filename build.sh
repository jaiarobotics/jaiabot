#!/bin/bash

if [ -z "${JAIABOT_CORE_CMAKE_FLAGS}" ]; then
    JAIABOT_CORE_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_CORE_MAKE_FLAGS}" ]; then
    JAIABOT_CORE_MAKE_FLAGS=
fi

set -e -u
mkdir -p build

echo "Configuring..."
cd build
(set -x; cmake .. ${JAIABOT_CORE_CMAKE_FLAGS})
echo "Building..."
(set -x; cmake --build . -- -j`nproc` ${JAIABOT_CORE_MAKE_FLAGS} $@)
