#!/bin/bash

TARGET_DIR=$1
JAIA_DIR="$(pwd)/../../"

# Build the venv
echo 🟢 Building the python venv into ${TARGET_DIR}

    # Make target python directory
    mkdir -p ${TARGET_DIR}

    # Install the pyjaia directory into the intermediate build products directory
        # Rsync the requirements.txt and pyjaia directory
        rsync -a requirements.txt pyjaia ${TARGET_DIR}
        # Build the messages to the intermediate build product directory
        ./pyjaia/build_messages.sh ${JAIA_DIR} ${TARGET_DIR}/pyjaia

    # Create the venv
    pushd ${TARGET_DIR} > /dev/null
        python3 -m venv venv
        ./venv/bin/pip install -q wheel
        ./venv/bin/pip install -q -r requirements.txt
    popd > /dev/null
