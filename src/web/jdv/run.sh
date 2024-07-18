#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Install the dependency packages
../install_dependencies.sh ../

WEB_APPS_DIR="$(pwd)/../../../build/web_dev/"
JDV_DIR="${WEB_APPS_DIR}/jdv"

# Build messages and install pyjaia
pushd ../../python/ > /dev/null
    ./build_venv.sh ${WEB_APPS_DIR}/python
popd > /dev/null

# Start server
pushd server > /dev/null
    ${WEB_APPS_DIR}/python/venv/bin/python3 jaiabot_data_vision.py -a ${JDV_DIR} -p 40011 -l INFO $@ &
popd > /dev/null

# Build client
pushd client > /dev/null
    echo "🟢 Building JDV into ${JDV_DIR}"
    npx webpack --mode development --config ./release.webpack.config.js --env TARGET_DIR=${JDV_DIR} --stats minimal --watch
popd > /dev/null
