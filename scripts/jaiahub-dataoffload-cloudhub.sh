#!/bin/bash

set -e

set -a
source /etc/jaiabot/runtime.env
set +a

IP_PY="/etc/jaiabot/ip.py"
CLOUDHUB_ID=30
CLOUDHUB_IP=$(${IP_PY} addr --node hub --net cloudhub_vpn --fleet_id ${jaia_fleet_index} --node_id ${CLOUDHUB_ID} --ipv6)

# ensure we use consistent read-only perms
chmod -R 440 /var/log/jaiabot/bot_offload/*

# use non-s3fs temporary directory
rsync -r --temp-dir=/var/log/jaiabot --info=progress2 --no-inc-recursive --timeout=15 /var/log/jaiabot/bot_offload/ jaia@[${CLOUDHUB_IP}]:/var/log/jaiabot/bot_offload/
