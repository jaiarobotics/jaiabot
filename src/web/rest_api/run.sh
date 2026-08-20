#!/bin/bash

set -e

source "$(dirname "${BASH_SOURCE[0]}")/../resolve_shared_venv.sh"
require_shared_venv

# Source the shared python venv built by CMake.
source "${SHARED_VENV_DIR}/bin/activate"

# Start server
echo 🟢 Starting rest api
./app.py -e 1:localhost:40000
