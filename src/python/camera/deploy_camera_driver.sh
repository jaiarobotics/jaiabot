#!/bin/bash

PYTHON_DIR="../"
SOURCES="${PYTHON_DIR}/pyjaiaprotobuf ${PYTHON_DIR}/jaia_serial ${PYTHON_DIR}/camera"
TARGET="$1:"

echo "🟢 Syncing code to $1"
rsync -za --delete ${SOURCES} ${TARGET}

ssh $1 './camera/local_deploy.sh'
