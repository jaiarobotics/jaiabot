#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"


# Build the venv
pushd ../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
    source ${BUILD_DIR}/python/venv/bin/activate
popd > /dev/null


# Build JCC and JED clients
# Install pre-requisites
./install_dependencies.sh ./
mkdir -p ${BUILD_DIR}
echo 🟢 Building JCC and JED into ${BUILD_DIR}
npx webpack --mode production --env OUTPUT_DIR=${BUILD_DIR} --progress


# Start server
pushd server > /dev/null
    ./app.py -a ${BUILD_DIR} $1 &
popd > /dev/null


# Watch build JCC and JED clients for development
npx webpack --mode development --env OUTPUT_DIR=${BUILD_DIR} --watch --progress
