#!/bin/bash

if [ -z "$1" ]
then
      DEST_HOSTNAME='jaia@mercury'
else
      DEST_HOSTNAME=$1
fi

echo "🟢 Uploading logs to ${DEST_HOSTNAME}"

set -ex

# Link to staging for a flat directory structure
mkdir -p staging
find /var/log/jaiabot -name '*.goby' -size -50M -exec ln -sf {} staging/ \;

rsync -zaLP staging/ ${DEST_HOSTNAME}:/var/log/jaiaplot/

set +x

echo "✅ Successfully uploaded all logs!"
