#!/bin/bash

set -e 

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

source "$(dirname "${BASH_SOURCE[0]}")/../python/resolve_venv.sh"
require_venv

# Configure package.json
(cd ${JAIA_DIR}; cmake -P cmake/ConfigurePackageJSON.cmake)

# the venv is built with --system-site-packages, so the server's imports resolve to these
${JAIA_DIR}/scripts/build/install-runtime-deps.sh jaiabot-python jaiabot-web

# Source the python venv built by CMake.
source "${JAIA_VENV_DIR}/bin/activate"


if ! which npm; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
fi

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
