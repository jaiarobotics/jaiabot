#!/bin/bash

# Runs on the CloudHub. Enrolls a VirtualHub on the fleet's CloudHub VPN, as a field hub
# pairs, so the two exchange hub-to-hub traffic. A VirtualFleet otherwise reaches the
# CloudHub only over its own VPN, which carries none.
#
# Usage: enroll-virtualhub.sh <fleet id> [<hub id>]

set -u -e

FLEET=$1
HUB_ID=${2:-1}
WG_PROFILE=wg_jaia_ch${FLEET}
HANDSHAKE_WAIT_SECONDS=120

hub_addr=$(jaia_ip --query_type addr --node_type hub --ip_net vfleet_vpn \
                   --fleet_id "${FLEET}" --node_id "${HUB_ID}")
on_hub() { ssh -n -o StrictHostKeyChecking=no "jaia@${hub_addr}" "$@"; }

pubkey=$(on_hub "sudo bash -c 'umask 077; [ -s /etc/wireguard/privatekey ] || wg genkey > /etc/wireguard/privatekey; wg pubkey < /etc/wireguard/privatekey'")

# What a pairing node's SSH session runs: called directly, as CI keeps the pairing port closed
conf=$(SSH_ORIGINAL_COMMAND="hub ${HUB_ID} ${pubkey}" /usr/bin/jaia-vpn-enroll.sh)

# Over the VPC, as the VirtualFleet VPN's own endpoint is, not out to the public address
cloudhub_addr=$(ip -6 -o addr show dev eth0 scope global | awk '{print $4; exit}' | cut -d/ -f1)
conf=$(sed -e '/^# jaia-cloudhub-ssh-key: /d' \
           -e "s|^Endpoint = .*:\([0-9]*\)\$|Endpoint = [${cloudhub_addr}]:\1|" <<< "${conf}")

ssh -o StrictHostKeyChecking=no "jaia@${hub_addr}" "cat > /tmp/${WG_PROFILE}.conf" <<< "${conf}"
ssh -o StrictHostKeyChecking=no "jaia@${hub_addr}" sudo bash -s -- "${WG_PROFILE}" <<'HUB'
set -u -e
profile=$1
umask 077
sed "s|^PrivateKey =.*|PrivateKey = $(cat /etc/wireguard/privatekey)|" \
    /tmp/${profile}.conf > /etc/wireguard/${profile}.conf
rm /tmp/${profile}.conf
systemctl enable --now wg-quick@${profile}
# The portal addresses the other hubs on this VPN only if it is up when the portal starts
systemctl restart jaiabot_goby_intervehicle_portal
HUB

deadline=$((SECONDS + HANDSHAKE_WAIT_SECONDS))
until handshake=$(on_hub "sudo wg show ${WG_PROFILE} latest-handshakes" | awk '{print $2; exit}') \
        && [ -n "${handshake}" ] && [ "${handshake}" != 0 ]; do
    if (( SECONDS >= deadline )); then
        # Not fatal: the trial's hub2hub tier reports the hubs not hearing each other,
        # and the rest of the trial still runs
        echo "WARNING: VirtualHub ${HUB_ID} has not handshaken on ${WG_PROFILE} after ${HANDSHAKE_WAIT_SECONDS} s" >&2
        on_hub "sudo wg show ${WG_PROFILE}" >&2 || true
        exit 0
    fi
    sleep 2
done
echo "VirtualHub ${HUB_ID} is on ${WG_PROFILE}"
