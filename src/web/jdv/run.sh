#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install the dependency packages
../install_dependencies.sh ../

BUILD_DIR="$(pwd)/../../../build/web_dev/"
CLIENT_DIR="${BUILD_DIR}/jdv"

# Build messages and install pyjaia
pushd ../../python/ > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
popd > /dev/null

# Start server
pushd server
    ./jaiabot_data_vision.py -a ${BUILD_DIR} -p 40011 -l INFO $@ &
popd

# Build client
pushd client
    npx webpack --mode production --config ./release.webpack.config.js --env TARGET_DIR=${CLIENT_DIR} --watch
popd
