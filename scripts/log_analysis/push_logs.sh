
#!/bin/bash

DEST_HOSTNAME=optiplex

set -ex
ssh ${DEST_HOSTNAME} mkdir -p '${HOME}'/jaia-logs/`hostname`
rsync -zaP ${HOME}/jaia-logs/ ${DEST_HOSTNAME}:jaia-logs/`hostname`
rm -rf ${HOME}/jaia-logs/*

echo "✅ Successfully uploaded all logs!"
