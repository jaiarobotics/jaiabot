#!/bin/bash

# Locates the Python venv built by the CMake jaiabot_python_venv target.
# Sourced by the run.sh scripts under src/web/ - not meant to be executed directly.

# Repo root, derived from this file's location so resolution does not depend on the
# caller's working directory.
_jaia_venv_repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

resolve_venv() {
    local venv_path

    # On an installed system the venv is built by jaiabot-python.postinst, which writes
    # no completion stamp, so bin/activate is the only marker available here.
    if [ -n "${jaia_share_dir}" ] && [ -f "${jaia_share_dir}/jaiabot/python/venv/bin/activate" ]; then
        echo "${jaia_share_dir}/jaiabot/python/venv"
        return 0
    fi

    # In the build tree, check the stamp the CMake target touches only after pip
    # succeeds - a venv left half-installed by a failed build should not resolve.
    for venv_path in "${_jaia_venv_repo_dir}"/build/*/share/jaiabot/python/venv; do
        if [ -f "${venv_path}/.venv_complete" ]; then
            echo "${venv_path}"
            return 0
        fi
    done

    return 1
}

# Sets JAIA_VENV_DIR, or exits the calling script if the venv has not been built yet.
require_venv() {
    if ! JAIA_VENV_DIR=$(resolve_venv); then
        echo "🔴 Could not find a complete Python venv under build/*/share/jaiabot/python/venv"
        echo "   Run: cmake --build ${_jaia_venv_repo_dir}/build/amd64 --target jaiabot_python_venv"
        exit 1
    fi
}
