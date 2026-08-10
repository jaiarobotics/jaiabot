#!/bin/bash

set -e

set -a
source /etc/jaiabot/runtime.env
set +a

CLOUDHUB_ID=30
CLOUDHUB_IP=$(jaia_ip --query_type addr --node_type hub --ip_net cloudhub_vpn --fleet_id ${jaia_fleet_id} --node_id ${CLOUDHUB_ID} --ip_version ipv6)

# use non-s3fs temporary directory
rsync -r -c --temp-dir=/var/log/jaiabot --info=progress2 --no-inc-recursive --timeout=15 /var/log/jaiabot/bot_offload/ jaia@[${CLOUDHUB_IP}]:/var/log/jaiabot/bot_offload/
