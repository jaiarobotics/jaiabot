#!/bin/bash

if [ -z "$1" ]
then
      DEST_HOSTNAME='jaia@mercury'
else
      DEST_HOSTNAME=$1
fi

echo "🟢 Uploading logs to ${DEST_HOSTNAME}"

set -ex

shopt -s globstar
rsync -zvP /var/log/jaiabot/**/*.goby ${DEST_HOSTNAME}:jaiaplot-logs/

set +x

echo "✅ Successfully uploaded all logs!"
