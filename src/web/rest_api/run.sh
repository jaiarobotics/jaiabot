#!/bin/bash

set -e

source "$(dirname "${BASH_SOURCE[0]}")/../../python/resolve_venv.sh"
require_venv

# Source the python venv built by CMake.
source "${JAIA_VENV_DIR}/bin/activate"

# Start server
echo 🟢 Starting rest api
./app.py -e 1:localhost:40000
