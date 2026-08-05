#!/bin/bash

set -e 

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../"
BUILD_DIR="${JAIA_DIR}/build/web_dev/"

resolve_shared_venv() {
    local venv_path

    if [ -n "${jaia_share_dir}" ] && [ -d "${jaia_share_dir}/jaiabot/python/venv" ]; then
        echo "${jaia_share_dir}/jaiabot/python/venv"
        return 0
    fi

    venv_path=$(find "${JAIA_DIR}/build" -mindepth 5 -maxdepth 5 -type d -path "*/share/jaiabot/python/venv" | head -n 1)
    if [ -n "${venv_path}" ]; then
        echo "${venv_path}"
        return 0
    fi

    return 1
}

if ! SHARED_VENV_DIR=$(resolve_shared_venv); then
    echo "🔴 Could not find shared Python venv under build/*/share/jaiabot/python/venv"
    echo "   Run: cmake --build ${JAIA_DIR}/build/amd64 --target jaiabot_python_venv"
    exit 1
fi

# Configure package.json
(cd ${JAIA_DIR}; cmake -P cmake/ConfigurePackageJSON.cmake)

# Source the shared python venv built by CMake.
source "${SHARED_VENV_DIR}/bin/activate"


# Build JCC and JED clients
# Install pre-requisites
./install_dependencies.sh ./


# Set up pre-commit hooks
pushd ${JAIA_DIR}/scripts/git-hooks/init/pre-commit/ > /dev/null
    ./set-pre-commit-hook.sh
popd > /dev/null


# Determine ports
hub_id=${jaia_hub_index:-1}
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
