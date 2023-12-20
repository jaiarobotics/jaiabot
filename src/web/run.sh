#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="../../"
BUILD_DIR="${JAIA_DIR}/build/intermediate"

# Install pre-requisites
./install_dependencies.sh ${BUILD_DIR}

# Build the venv

## Make target python directory
mkdir -p ${BUILD_DIR}/python/

## install the pyjaia directory into the intermediate build products directory
### rsync the requirements.txt and pyjaia directory
rsync -a ${JAIA_DIR}/src/python/requirements.txt ${JAIA_DIR}/src/python/pyjaia ${BUILD_DIR}/python/
### build the messages to the intermediate build product directory
./build_messages.sh ${JAIA_DIR} ${BUILD_DIR}/python/pyjaia

## Create the venv
pushd ${BUILD_DIR}/python/
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
popd

# Start server
pushd server
    ${BUILD_DIR}/python/venv/bin/python3 ./app.py $1 &
popd

# Build Command Control
pushd command_control
    npm install --no-audit
    npm run test
popd
