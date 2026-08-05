#!/bin/bash

set -e

JAIA_DIR="$(pwd)/../../../"
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

# Source the shared python venv built by CMake.
source "${SHARED_VENV_DIR}/bin/activate"

# Start server
echo 🟢 Starting rest api
./app.py -e 1:localhost:40000
