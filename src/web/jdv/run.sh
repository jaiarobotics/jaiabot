#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Start server
pushd server
    ./jaiabot_data_vision.py -p 40011 &
popd

# Build client
pushd client
    npm install --no-audit
    npm run test
popd
