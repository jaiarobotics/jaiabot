#!/bin/bash

# The forced command behind the fleet's bootstrap SSH key. A node holding that
# key can enrol itself on the CloudHub VPN and do nothing else, so the copy of
# it on every node's boot media is worth no more than one peer entry.

set -u -e

CLOUD_ENV="${JAIA_CLOUD_ENV:-/etc/jaiabot/cloud.env}"
OUT_DIR="${JAIA_VPN_OUT_DIR:-/tmp}"
SERVER_IFACE=wg_cloudhub

fail()
{
    echo "ERROR: $*" >&2
    exit 1
}

read -r -a request <<<"${SSH_ORIGINAL_COMMAND:-}"
usage="expected 'bot|hub <node id> <wireguard public key>' or 'iridium <wireguard public key>'"

iridium=false
if [ ${#request[@]} -eq 2 ] && [ "${request[0]}" = iridium ]; then
    # iridium.jaia.tech relays the fleet's Iridium messages, always as the same hub id
    iridium=true
    node_type=hub
    node_id=$(jaia_bounds --iridium_id)
    pubkey=${request[1]}
else
    [ ${#request[@]} -eq 3 ] || fail "${usage}"
    node_type=${request[0]}
    node_id=${request[1]}
    pubkey=${request[2]}
fi

case "$node_type" in
    bot | hub) ;;
    *) fail "'${node_type}' is not a node type" ;;
esac
case "$node_id" in
    "" | *[!0-9]*) fail "'${node_id}' is not a node id" ;;
esac

# A re-imaged node comes back with a new key, so enrolling twice replaces the
# peer rather than refusing.
sudo jaia-vpn-peers.sh remove "${SERVER_IFACE}" "${node_type}${node_id}" >/dev/null 2>&1 || true

# Nothing but the config may reach stdout: that is the channel the node reads.
jaia-vpn-gen.sh cloudhub_vpn "${node_type}" "${node_id}" "${pubkey}" >&2

# The CloudHub's JCU acts on the nodes in its inventory, and enrolment is the only
# time it learns of one. A stale inventory must not cost the node its pairing.
sudo jaia-vpn-inventory.sh >&2 || echo "WARNING: could not update the CloudHub's inventory" >&2

set -a; source "${CLOUD_ENV}"; set +a
cat "${OUT_DIR}/${node_type}${node_id}/wg_jaia_ch${jaia_fleet_id}.conf"

# iridium.jaia.tech never lets the CloudHub in, so it is not sent the CloudHub's key
[ "${iridium}" = false ] || exit 0

# The node lets the CloudHub in for fleet actions by this key, restricted to the
# CloudHub's own VPN address as its fleet config does. A rebuilt CloudHub has a new
# key, and pairing is when the node can learn it; the node strips this line from
# the config it installs.
SSH_DIR="${JAIA_SSH_DIR:-/home/jaia/.ssh}"
if cloudhub_id=$(jaia_bounds --cloudhub_id 2>/dev/null) \
    && cloudhub_pubkey="${SSH_DIR}/hub${cloudhub_id}_fleet${jaia_fleet_id}.pub" && [ -r "${cloudhub_pubkey}" ] \
    && cloudhub_ip=$(jaia_ip --query_type addr --node_type hub --ip_net cloudhub_vpn \
                             --fleet_id "${jaia_fleet_id}" --node_id "${cloudhub_id}" 2>/dev/null); then
    echo "# jaia-cloudhub-ssh-key: from=\"${cloudhub_ip}\" $(cut -d' ' -f1,2 "${cloudhub_pubkey}") hub${cloudhub_id}_fleet${jaia_fleet_id}"
else
    echo "WARNING: this CloudHub's SSH public key was not found, so ${node_type} ${node_id} will not accept its fleet actions" >&2
fi
