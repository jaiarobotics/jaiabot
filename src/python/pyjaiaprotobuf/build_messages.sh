#!/bin/bash

set -e

# The root of the jaiabot directory tree, where we'll find the source proto files
if [[ -z "$1" ]]; then
    JAIABOT_DIR="$(pwd)/../../../"
else
    JAIABOT_DIR=$"$1"
fi  

# The target directory in which to build the protobuf python files
if [[ -z "$2" ]]; then
    PYTHON_OUT_DIR="$(pwd)/src/"
else
    PYTHON_OUT_DIR=$"$2/src/"
fi

echo "🟢 Building Jaia protobuf python modules"

# invoke CMake to build the python protobufs to the desired location
BUILD_DIR=/tmp/jaiabot-python-proto-build
cmake -S "$JAIABOT_DIR" -B "$BUILD_DIR" \
    -DPYJAIAPROTOBUF_SRC_OUTDIR="${PYTHON_OUT_DIR}"
cmake --build "$BUILD_DIR" --target pyjaiaprotobuf

# Remove the temporary build directory
rm -rf ${BUILD_DIR}
