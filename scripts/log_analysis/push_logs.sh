
#!/bin/bash

DEST_HOSTNAME=optiplex

set -ex

ssh ${DEST_HOSTNAME} mkdir -p '${HOME}'/jaia-logs/`hostname`
rsync -zaP /var/log/jaiabot/ ${DEST_HOSTNAME}:jaia-logs/`hostname`
sudo rm -rf /var/log/jaiabot/*

set +x

echo "✅ Successfully uploaded all logs!"
