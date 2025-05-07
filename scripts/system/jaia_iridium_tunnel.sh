#!/bin/bash

FLEET=$1

# This port is set by Iridium
IRIDIUM_MT_PORT=10800

# No need for this to correlate with the same port that Iridium uses
# but might as well to keep things semi-consistent
JAIA_IRIDIUM_MT_PORT_BASE=${IRIDIUM_MT_PORT}  # Add FLEET to get port for multiplexing
JAIA_IRIDIUM_MO_PORT_BASE=$((IRIDIUM_MT_PORT+1000))  # Add FLEET to get port for multiplexing
CLOUDHUB_IRIDIUM_MO_PORT=${JAIA_IRIDIUM_MO_PORT_BASE}

# MO Tunnel
(set -x; /usr/bin/socat TCP-LISTEN:$((FLEET+${JAIA_IRIDIUM_MO_PORT_BASE})),reuseaddr,fork TCP:[$(jaia ip chf${FLEET})]:${CLOUDHUB_IRIDIUM_MO_PORT})&

# MT Tunnel
(set -x; /usr/bin/socat TCP-LISTEN:$((FLEET+${JAIA_IRIDIUM_MT_PORT_BASE})),reuseaddr,fork TCP:directip.sbd.iridium.com:${IRIDIUM_MT_PORT})&

wait
