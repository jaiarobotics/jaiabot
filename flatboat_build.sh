#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

set -e -u
mkdir -p build

echo "Configuring..."
cd build
(set -x; cmake .. ${JAIABOT_CMAKE_FLAGS})
echo "Building..."
(set -x; cmake --build . -- -j 1 ${JAIABOT_MAKE_FLAGS} $@)
