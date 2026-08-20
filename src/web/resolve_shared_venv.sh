#!/bin/bash

# Locates the shared Python venv built by the CMake jaiabot_python_venv target.
# Sourced by the run.sh scripts under src/web/ - not meant to be executed directly.

# Repo root, derived from this file's location so resolution does not depend on the
# caller's working directory.
_jaia_venv_repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

resolve_shared_venv() {
    local venv_path

    if [ -n "${jaia_share_dir}" ] && [ -d "${jaia_share_dir}/jaiabot/python/venv" ]; then
        echo "${jaia_share_dir}/jaiabot/python/venv"
        return 0
    fi

    venv_path=$(find "${_jaia_venv_repo_dir}/build" -mindepth 5 -maxdepth 5 -type d -path "*/share/jaiabot/python/venv" | head -n 1)
    if [ -n "${venv_path}" ]; then
        echo "${venv_path}"
        return 0
    fi

    return 1
}

# Sets SHARED_VENV_DIR, or exits the calling script if the venv has not been built yet.
require_shared_venv() {
    if ! SHARED_VENV_DIR=$(resolve_shared_venv); then
        echo "🔴 Could not find shared Python venv under build/*/share/jaiabot/python/venv"
        echo "   Run: cmake --build ${_jaia_venv_repo_dir}/build/amd64 --target jaiabot_python_venv"
        exit 1
    fi
}
