#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install pre-requisites
./install_dependencies.sh

# Build messages and install pyjaia
pushd ../python/pyjaia
    ./build_messages.sh
    python3 -m pip install ./
popd

# Start server
pushd server
    ./app.py $1 &
popd

# Build Command Control
pushd command_control
    npm install --no-audit
    npm run test
popd
