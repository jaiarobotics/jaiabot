#!/bin/bash

set -e

set -a
source /etc/jaiabot/runtime.env
set +a

CLOUDHUB_IP=$(jaia_ip chf${jaia_fleet_index})

# use non-s3fs temporary directory
rsync -r -c --temp-dir=/var/log/jaiabot --info=progress2 --no-inc-recursive --timeout=15 /var/log/jaiabot/bot_offload/ jaia@[${CLOUDHUB_IP}]:/var/log/jaiabot/bot_offload/
