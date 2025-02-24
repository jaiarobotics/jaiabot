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
        rsync -a requirements.txt pyjaia pyjaiaprotobuf Adafruit_CircuitPython_BNO08x ${TARGET_DIR}
        # Build the messages to the intermediate build product directory
        ./pyjaiaprotobuf/build_messages.sh ${JAIA_DIR} ${TARGET_DIR}/pyjaiaprotobuf

    # Create the venv
    pushd ${TARGET_DIR} > /dev/null
        python3 -m venv venv
        ./venv/bin/pip install -qU pip
        ./venv/bin/pip install -qU wheel
        ./venv/bin/pip install -qU setuptools
	./venv/bin/pip install -qr requirements.txt
    popd > /dev/null
