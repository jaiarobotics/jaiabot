#!/bin/bash

set -e 

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Configure package.json
(cd ${JAIA_DIR}; cmake -P cmake/ConfigurePackageJSON.cmake)

# Build the venv
pushd ../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
    source ${BUILD_DIR}/python/venv/bin/activate
popd > /dev/null


# Build JCC and JED clients
# Install pre-requisites
./install_dependencies.sh ./


# Set up pre-commit hooks
pushd ${JAIA_DIR}/scripts/git-hooks/init/pre-commit/ > /dev/null
    ./set-pre-commit-hook.sh
popd > /dev/null


# Start server
echo 🟢 Starting server
pushd server > /dev/null
    ./app.py -a ${BUILD_DIR} $1 &
popd > /dev/null


# Watch build JCC and JED clients for development
echo 🟢 Building the client apps. Please wait until initial build completes before loading JCC or JED in browser.
npx webpack --mode development --env OUTPUT_DIR=${BUILD_DIR} --watch --progress
