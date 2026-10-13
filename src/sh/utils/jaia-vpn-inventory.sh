#!/bin/bash

# Writes the CloudHub's Ansible inventory from the nodes enrolled on its VPN.
# The CloudHub reaches the fleet only over that VPN, so its peers are the nodes
# its JCU can act on. The fleet config it was built from can name fewer (nodes
# added since) or more (nodes not yet paired).

set -u -e

CLOUD_ENV="${JAIA_CLOUD_ENV:-/etc/jaiabot/cloud.env}"
INVENTORY="${JAIA_INVENTORY:-/etc/jaiabot/inventory.yml}"
SERVER_IFACE=wg_cloudhub
CLOUDHUB_ID=30

set -a; source "${CLOUD_ENV}"; set +a

bots=()
hubs=(${CLOUDHUB_ID})
for peer in $(jaia-vpn-peers.sh list "${SERVER_IFACE}"); do
    if [[ "$peer" =~ ^bot([0-9]+)$ ]]; then
        bots+=("${BASH_REMATCH[1]}")
    elif [[ "$peer" =~ ^hub([0-9]+)$ ]]; then
        hubs+=("${BASH_REMATCH[1]}")
    fi
done

ids()
{
    [ $# -gt 0 ] || return 0
    printf '%s\n' "$@" | sort -n | paste -s -d, -
}

TMPFILE=$(mktemp "${INVENTORY}.XXXXXX")
trap 'rm -f "${TMPFILE}"' EXIT

jaia-create-ansible-inventory.sh -b "$(ids ${bots[@]+"${bots[@]}"})" -h "$(ids "${hubs[@]}")" \
    -f "${jaia_fleet_id}" -n cloudhub_vpn > "${TMPFILE}"

if [ -e "${INVENTORY}" ]; then
    chown --reference="${INVENTORY}" "${TMPFILE}"
    chmod --reference="${INVENTORY}" "${TMPFILE}"
else
    chmod 644 "${TMPFILE}"
fi
mv "${TMPFILE}" "${INVENTORY}"
