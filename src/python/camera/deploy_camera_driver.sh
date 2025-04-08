#!/bin/bash

if [ -z $1 ]; then
    echo "Usage: deploy_camera_driver.sh target"
    echo ""
    echo "Parameters"
    echo "target: hostname or IP address of the destination Pi Zero"
    exit 1
fi


PYTHON_DIR="../"
SOURCES="${PYTHON_DIR}/pyjaiaprotobuf ${PYTHON_DIR}/jaia_serial ${PYTHON_DIR}/camera"
TARGET="$1:"

echo "🟢 Syncing code to $TARGET"
rsync -za --delete ${SOURCES} ${TARGET}

ssh $1 './camera/local_deploy.sh'
