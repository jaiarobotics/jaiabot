#!/bin/bash

set -e

# Build Central Command
pushd central_command
    make
popd

# Build messages and start server
pushd server
    ./build_messages.sh
    ./app.py $1
popd server
