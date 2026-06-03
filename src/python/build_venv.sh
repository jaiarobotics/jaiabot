#!/bin/bash

set -e

TARGET_DIR=$1

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: $0 TARGET_DIR"
    exit 1
fi

JAIA_DIR="$(pwd)/../../"

# Build the venv
echo 🟢 Building the python venv into ${TARGET_DIR}

    # Make target python directory
    mkdir -p ${TARGET_DIR}

    # Install the pyjaia directory into the intermediate build products directory
        # Rsync the requirements.txt and pyjaia directory
        rsync -a requirements.txt pyjaia pyjaiaprotobuf Adafruit_CircuitPython_BNO08x jaia_serial ${TARGET_DIR}
        # Build the messages to the intermediate build product directory
        ./pyjaiaprotobuf/build_messages.sh ${JAIA_DIR} ${TARGET_DIR}/pyjaiaprotobuf

    # Create the venv
    pushd ${TARGET_DIR} > /dev/null
        # Recreate the development venv from scratch each time. Re-running
        # `python3 -m venv` over an existing venv can fail with
        # `[Errno 17] File exists: .../site-packages` on some Python 3.12
        # installations, which prevents JDV/JCC dev launch scripts from
        # starting after a previous build. The target is an intermediate build
        # directory, so it is safe to clear the generated venv before building.
        rm -rf venv
        python3 -m venv venv --system-site-packages
        ./venv/bin/pip install -qU wheel
        ./venv/bin/pip install -r requirements.txt
    popd > /dev/null
