#!/bin/bash

set -e

# jaia_fleet_id is inherited from the jaiabot_hub_manager unit that starts this
CLOUDHUB_IP=$(jaia_ip chf${jaia_fleet_id})

# use non-s3fs temporary directory
rsync -r -c --temp-dir=/var/log/jaiabot --info=progress2 --no-inc-recursive --timeout=15 /var/log/jaiabot/bot_offload/ jaia@[${CLOUDHUB_IP}]:/var/log/jaiabot/bot_offload/
