#!/bin/bash

set -u -e

FLEET=$1

WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"

# Iridium DirectIP (MetOcean)
## This port is set by Iridium
IRIDIUM_MT_PORT=10800

## No need for this to correlate with the same port that Iridium uses
## but might as well to keep things semi-consistent
JAIA_IRIDIUM_MT_PORT_BASE=${IRIDIUM_MT_PORT}  # Add FLEET to get port for multiplexing
JAIA_IRIDIUM_MO_PORT_BASE=$((IRIDIUM_MT_PORT+1000))  # Add FLEET to get port for multiplexing
CLOUDHUB_IRIDIUM_MO_PORT=${JAIA_IRIDIUM_MO_PORT_BASE}

# RockBLOCK

## MT is handled directly via HTTPS post from Cloudhub

JAIA_ROCKBLOCK_MO_PORT_BASE=12800  # Add FLEET to get port for multiplexing
CLOUDHUB_ROCKBLOCK_MO_PORT=${JAIA_ROCKBLOCK_MO_PORT_BASE}

# This server serves release 2 and release 3 fleets, whose CloudHub VPNs number hubs
# differently (hub 25 is ::19 or ::1:19, the CloudHub ::1e or ::1:1e), so the CloudHub's
# address comes from this server's own end of the fleet's tunnel.
own_address=$(sed -n 's|^Address *= *\([^/]*\).*|\1|p' "${WG_DIR}/wg_jaia_ch${FLEET}.conf" | head -1)
iridium_host=$(printf '%x' "$(jaia_bounds --iridium_id)")
cloudhub_host=$(printf '%x' "$(jaia_bounds --cloudhub_id)")
case "${own_address}" in
    *::${iridium_host} | *::1:${iridium_host}) CLOUDHUB_ADDRESS="${own_address%${iridium_host}}${cloudhub_host}" ;;
    *)
        echo "ERROR: '${own_address}' in ${WG_DIR}/wg_jaia_ch${FLEET}.conf is not hub $(jaia_bounds --iridium_id)'s address on fleet ${FLEET}'s CloudHub VPN" >&2
        exit 1
        ;;
esac
if [ "${2:-}" = --cloudhub-address ]; then
    echo "${CLOUDHUB_ADDRESS}"
    exit 0
fi

# Iridium DirectIP (MetOcean)
## MO Tunnel
(set -x; socat TCP-LISTEN:$((FLEET+${JAIA_IRIDIUM_MO_PORT_BASE})),reuseaddr,fork TCP:[${CLOUDHUB_ADDRESS}]:${CLOUDHUB_IRIDIUM_MO_PORT})&

## MT Tunnel
(set -x; socat TCP-LISTEN:$((FLEET+${JAIA_IRIDIUM_MT_PORT_BASE})),reuseaddr,fork TCP:directip.sbd.iridium.com:${IRIDIUM_MT_PORT})&

# RockBLOCK

## MO Tunnel
(set -x; socat TCP-LISTEN:$((FLEET+${JAIA_ROCKBLOCK_MO_PORT_BASE})),reuseaddr,fork TCP:[${CLOUDHUB_ADDRESS}]:${CLOUDHUB_ROCKBLOCK_MO_PORT})&

wait
