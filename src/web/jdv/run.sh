#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install the dependency packages
../install_dependencies.sh ../

BUILD_DIR="$(pwd)/../../../build/web_dev/"

# Build messages and install pyjaia
pushd ../../python/ > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
popd > /dev/null

# Build client
pushd client
    ./build.sh ${BUILD_DIR}/jdv
popd

# Start server
pushd server
    ./jaiabot_data_vision.py -a ${BUILD_DIR} -p 40011 -l INFO $@ &
popd
