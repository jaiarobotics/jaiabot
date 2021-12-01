#!/bin/bash

export REMOTE_SERVER=$1
export REMOTE_DIR=jaiabot/src/python/xbee

ssh ${REMOTE_SERVER} mkdir -p ${REMOTE_DIR}
rsync -P *.py ${REMOTE_SERVER}:${REMOTE_DIR}
echo Sync done
ssh -t -t ${REMOTE_SERVER} "${REMOTE_DIR}/xbee_listen.py"

echo Done running!
