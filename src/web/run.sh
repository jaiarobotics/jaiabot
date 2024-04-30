#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Build the venv
pushd ../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
popd > /dev/null

# Start server
pushd server > /dev/null
    ${BUILD_DIR}/python/venv/bin/python3 ./app.py -a ${BUILD_DIR} $1 &
popd > /dev/null

# Build Command Control
    # Install pre-requisites
    ./install_dependencies.sh ./

    # Copy the webpack.config.js file to the intermediate build directory, so webpack can import from node_modules
    COMMAND_CONTROL_BUILD_DIR=${BUILD_DIR}/jcc
    mkdir -p ${COMMAND_CONTROL_BUILD_DIR}

    echo 🟢 Building JCC into ${COMMAND_CONTROL_BUILD_DIR}
    npx webpack --mode production --env OUTPUT_DIR=${COMMAND_CONTROL_BUILD_DIR} --watch --progress
