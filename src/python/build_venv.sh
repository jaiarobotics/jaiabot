#!/bin/bash

set -e

TARGET_DIR=$1

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: $0 TARGET_DIR"
    exit 1
fi

JAIA_DIR="$(pwd)/../../"
STAMP_FILE="${TARGET_DIR}/venv/.build_stamp"

# Compare the timestamp of the requirements.txt and pyjaia directory to the stamp file. If the requirements.txt or pyjaia directory is newer than the stamp file, then rebuild the venv.
if [ -f "${STAMP_FILE}" ] && [ -z "$(find requirements.txt pyjaia pyjaiaprotobuf Adafruit_CircuitPython_BNO08x jaia_serial "${JAIA_DIR}/src/lib/messages" -newer "${STAMP_FILE}" -print -quit)" ]; then
    echo "🟢 Python venv is already up to date, skipping rebuild"
    exit 0
fi

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
        python3 -m venv venv --system-site-packages
        ./venv/bin/pip install -qU wheel
        ./venv/bin/pip install -r requirements.txt
        touch "${STAMP_FILE}"
    popd > /dev/null
