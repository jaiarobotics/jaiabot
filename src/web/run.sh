#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install pre-requisites
npm install --no-audit

# Build messages and start server
pushd server
    ./build_messages.sh
    ./app.py $1 &
popd

# Build Command Control
pushd command_control
    npm run test
popd
