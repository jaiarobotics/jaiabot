#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

ARCH=$(dpkg --print-architecture)

set -e -u
mkdir -p build/${ARCH}

echo "Configuring..."
cd build/${ARCH}
(set -x; cmake ../.. ${JAIABOT_CMAKE_FLAGS})
echo "Building..."
(set -x; cmake --build . -- -j`nproc` ${JAIABOT_MAKE_FLAGS} $@)
