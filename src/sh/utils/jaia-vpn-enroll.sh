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
[ ${#request[@]} -eq 3 ] || fail "expected 'bot|hub <node id> <wireguard public key>'"

node_type=${request[0]}
node_id=${request[1]}
pubkey=${request[2]}

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

set -a; source "${CLOUD_ENV}"; set +a
cat "${OUT_DIR}/${node_type}${node_id}/wg_jaia_ch${jaia_fleet_id}.conf"
