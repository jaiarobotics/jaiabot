#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Build the venv
## Make target python directory
mkdir -p ${BUILD_DIR}/python/

## install the pyjaia directory into the intermediate build products directory
### rsync the requirements.txt and pyjaia directory
rsync -a ${JAIA_DIR}/src/python/requirements.txt ${JAIA_DIR}/src/python/pyjaia ${BUILD_DIR}/python/
### build the messages to the intermediate build product directory
${JAIA_DIR}/src/python/pyjaia/build_messages.sh ${JAIA_DIR} ${BUILD_DIR}/python/pyjaia

## Create the venv
pushd ${BUILD_DIR}/python/ > /dev/null
    python3 -m venv venv
    ./venv/bin/pip install -q wheel
    ./venv/bin/pip install -q -r requirements.txt
popd > /dev/null

# Start server
pushd server > /dev/null
    ${BUILD_DIR}/python/venv/bin/python3 ./app.py -a ${BUILD_DIR} $1 &
popd > /dev/null

# Build Command Control
## Install pre-requisites
./install_dependencies.sh

## copy the webpack.config.js file to the intermediate build directory, so webpack can import from node_modules
COMMAND_CONTROL_BUILD_DIR=${BUILD_DIR}/command_control

pushd command_control > /dev/null
    ./build.sh ${COMMAND_CONTROL_BUILD_DIR}
popd > /dev/null
