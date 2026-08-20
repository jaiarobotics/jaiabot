#!/bin/bash

set -e

# Kill all descendants if we exit or are killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

JAIA_DIR="$(pwd)/../../../"

source "$(dirname "${BASH_SOURCE[0]}")/../resolve_shared_venv.sh"
require_shared_venv

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
