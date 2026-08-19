#!/bin/bash

set -e 

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

# Configure package.json
(cd ${JAIA_DIR}; cmake -P cmake/ConfigurePackageJSON.cmake)

# build_venv.sh creates the venv with --system-site-packages, and the server imports several
# modules that are only ever installed as system packages, so these must come first
${JAIA_DIR}/scripts/build/install-runtime-deps.sh jaiabot-python jaiabot-web

# Build the venv
pushd ../python > /dev/null
    ./build_venv.sh ${BUILD_DIR}/python
    source ${BUILD_DIR}/python/venv/bin/activate
popd > /dev/null


# Build JCC and JED clients
# Install pre-requisites
./install_dependencies.sh ./


# Regenerate the TypeScript protobuf types in case the .proto files changed
./gen_protobuf_types.sh


# Set up pre-commit hooks
pushd ${JAIA_DIR}/scripts/git-hooks/init/pre-commit/ > /dev/null
    ./set-pre-commit-hook.sh
popd > /dev/null


# Determine ports
hub_id=${jaia_hub_id:-1}
portal_port=$((40001 - hub_id))
web_port=$((40000 + hub_id))

# Start server
echo 🟢 Starting server for hub ${hub_id}
pushd server > /dev/null
    ./app.py -p ${portal_port} -P ${web_port} -a ${BUILD_DIR} $1 &
popd > /dev/null


# Watch build JCC and JED clients for development
echo 🟢 Building the client apps. Please wait until initial build completes before loading JCC or JED in browser.
npx webpack --mode development --env OUTPUT_DIR=${BUILD_DIR} --watch --progress
