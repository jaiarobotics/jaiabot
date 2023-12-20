#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Build the venv
pushd ../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
popd

# Start server
pushd server > /dev/null
    ${BUILD_DIR}/python/venv/bin/python3 ./app.py -a ${BUILD_DIR} $1 &
popd > /dev/null

# symlink jed to the build directory (so we can hot reload)
rm -rf ${BUILD_DIR}/jed
ln -s $(pwd)/jed ${BUILD_DIR}/jed

# Build Command Control
## Install pre-requisites
./install_dependencies.sh

## copy the webpack.config.js file to the intermediate build directory, so webpack can import from node_modules
COMMAND_CONTROL_BUILD_DIR=${BUILD_DIR}/command_control

pushd command_control > /dev/null
    ./build.sh ${COMMAND_CONTROL_BUILD_DIR}
popd > /dev/null
