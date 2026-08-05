#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../../"

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

# Install the dependency packages
../install_dependencies.sh ../

# Set up pre-commit hooks
pushd ${JAIA_DIR}/scripts/git-hooks/init/pre-commit/ > /dev/null
    ./set-pre-commit-hook.sh
popd > /dev/null

WEB_APPS_DIR="$(pwd)/../../../build/web_dev/"
JDV_DIR="${WEB_APPS_DIR}/jdv"

# Start server
pushd server > /dev/null
    "${SHARED_VENV_DIR}/bin/python3" jaiabot_data_vision.py -a ${JDV_DIR} -p 40011 -l INFO $@ &
popd > /dev/null

# Build client
pushd client > /dev/null
    echo "🟢 Building JDV into ${JDV_DIR}"
    npx webpack --mode development --env TARGET_DIR=${JDV_DIR} --stats minimal --watch
popd > /dev/null
