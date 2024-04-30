#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

WEB_DEV_DIR=$(realpath "../../../build/web_dev")

# Build messages and install pyjaia
pushd ../../python
    ./build_venv.sh ${WEB_DEV_DIR}/python
    PYTHON=${WEB_DEV_DIR}/python/venv/bin/python3
popd

# Start server
pushd ../server
    ${PYTHON} ./app.py -a ${WEB_DEV_DIR} $1 &
popd

# Build jed
# Install pre-requisites
../install_dependencies.sh ../
webpack --mode production --output-path ${WEB_DEV_DIR}/jed --watch --stats minimal
