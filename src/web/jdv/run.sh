#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install the dependency packages
pushd ..
    ./install_dependencies.sh
popd

BUILD_DIR="$(pwd)/../../../build/web_dev/"

# Build messages and install pyjaia
pushd ../../python/ > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
popd > /dev/null

# Start server
pushd server
    ${BUILD_DIR}/python/venv/bin/python3 ./jaiabot_data_vision.py -a ${BUILD_DIR} -p 40011 -l INFO $@ &
popd

# Build client
pushd client
    BUILD_JDV=${BUILD_DIR}/jdv
    echo "🟢 Building jdv into ${BUILD_JDV}"

    webpack --mode production --config ./test.webpack.config.js --env TARGET_DIR=${BUILD_JDV} --progress
popd
