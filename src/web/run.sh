#!/bin/bash

set -e

# Build Command Control
pushd command_control
    make
popd

# Build messages and start server
pushd server
    ./build_messages.sh
    ./app.py $1
popd
