#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Build messages and install pyjaia
pushd ../../python
    ./build_venv.sh .
popd

# Start server
pushd ../server
    ../../python/venv/bin/python3 ./app.py $1 &
popd

# Build jed
webpack --mode production --watch --stats minimal
