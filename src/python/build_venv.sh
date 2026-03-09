#!/bin/bash

set -e

TARGET_DIR=$1

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: $0 TARGET_DIR"
    exit 1
fi

JAIA_DIR="$(pwd)/../../"

# 0. Ensure MOOS is installed (needed for pymoos build)
if [ ! -f "/usr/local/include/MOOS/libMOOS/Comms/MOOSMsg.h" ]; then
    echo "🟡 MOOS not found. Installing MOOS..."

    sudo apt update
    sudo apt install -y git cmake build-essential

    TMP_DIR=$(mktemp -d)
    pushd $TMP_DIR > /dev/null

    git clone https://github.com/themoos/core-moos.git
    cd core-moos
    mkdir build
    cd build
    cmake ..
    make -j$(nproc)
    sudo make install

    popd > /dev/null
    rm -rf $TMP_DIR

    echo "✅ MOOS installed."
else
    echo "✅ MOOS already installed."
fi

# 1. Ensure uv is installed
if ! command -v uv &> /dev/null; then
    echo "🟡 uv not found. Installing uv to /usr/local/bin..."
    curl -LsSf https://astral.sh/uv/install.sh | BINDIR=/usr/local/bin sh
fi

# 2. Build the venv
echo "🟢 Building the python venv using uv into ${TARGET_DIR}"

mkdir -p ${TARGET_DIR}

rsync -a requirements.txt pyjaia pyjaiaprotobuf Adafruit_CircuitPython_BNO08x jaia_serial ${TARGET_DIR}

./pyjaiaprotobuf/build_messages.sh ${JAIA_DIR} ${TARGET_DIR}/pyjaiaprotobuf

pushd ${TARGET_DIR} > /dev/null

    uv venv venv --system-site-packages

    ./venv/bin/uv pip install -r requirements.txt

popd > /dev/null

echo "✅ Venv build complete."