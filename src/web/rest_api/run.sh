#!/bin/bash

set -e

JAIA_DIR="$(pwd)/../../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Build the venv
pushd ../../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
    source ${BUILD_DIR}/python/venv/bin/activate
popd > /dev/null

# Start server
echo 🟢 Starting rest api
./app.py -e 1:localhost:40000
