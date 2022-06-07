#!/bin/bash

set -e

# Build Central Command
pushd central_command
    ./build.sh
popd

# Build messages and start server
pushd server
    ./build_messages.sh
    if [ ! -z $1 ]
    then
        ./app.py $1
    fi
popd server
