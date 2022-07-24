#!/bin/bash

if [ -z "$1" ]
then
      DEST_HOSTNAME='jaia@optiplex'
else
      DEST_HOSTNAME=$1
fi

echo "🟢 Uploading logs to ${DEST_HOSTNAME}"

set -ex

find /var/log/jaiabot/ -name '*.goby' -print0 | xargs -0 -I'{}' rsync {} ${DEST_HOSTNAME}:jaiaplot-logs/

set +x

echo "✅ Successfully uploaded all logs!"
