#!/bin/bash

set -u -e -o pipefail

# Overridable so this can be run against directories other than the live ones.
BOOT_DIR="${JAIA_BOOT_DIR:-/boot/firmware}"
SSH_DIR="${JAIA_SSH_DIR:-/home/jaia/.ssh}"
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"
DEBCONF_SH="${JAIA_DEBCONF_SH:-/usr/bin/jaia-debconf.sh}"
HOST_FILE="${JAIA_CLOUDHUB_HOST_FILE:-/etc/jaiabot/cloudhub_host}"

# First boot names the CloudHub, or passes an empty name for a node that should not
# enroll. The name is kept so that running this again with no argument - as "Pair
# Fleet to CloudHub" does across a whole fleet - pairs against the same CloudHub.
if (( $# > 0 )); then
    CLOUDHUB_HOST=$1
    if [ -n "${CLOUDHUB_HOST}" ]; then
        echo "${CLOUDHUB_HOST}" | sudo tee "${HOST_FILE}" > /dev/null
    fi
else
    CLOUDHUB_HOST=$(cat "${HOST_FILE}" 2> /dev/null || true)
fi

BOOT_KEY=${BOOT_DIR}/jaiabot/init/id_vpn_tmp
PRIVATE_KEY=${SSH_DIR}/id_vpn_tmp

# What the CloudHub leaves in the config in place of a key it never holds
PLACEHOLDER="REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

if [ -z "${CLOUDHUB_HOST}" ]; then
    echo "No CloudHub given, not pairing"
    exit 0
fi

source ${DEBCONF_SH}

type=$(jaia_debconf_get type)
fleet=$(jaia_debconf_get fleet_id)
id=$(jaia_debconf_node_id)

WG_PROFILE=wg_jaia_ch${fleet}
WG_CONF=${WG_DIR}/${WG_PROFILE}.conf

if [ ! -e "${BOOT_KEY}" ] && [ ! -e "${PRIVATE_KEY}" ]; then
    # Paired already, and the key that did it spent: nothing to do, which is what
    # makes this safe to run on every node in a fleet
    if [ -e "${WG_CONF}" ]; then
        echo "Already paired with ${CLOUDHUB_HOST}"
        exit 0
    fi
    echo "Not paired, and no bootstrap key (id_vpn_tmp) to pair with"
    exit 0
fi

if ! timeout 10 bash -c "until ping -c1 1.1.1.1 >/dev/null 2>&1; do :; done"; then
    echo "No network after 10 seconds, not pairing"
    exit 1
fi

if [ -e "${BOOT_KEY}" ]; then
    sudo mount -o remount,rw ${BOOT_DIR}
    sudo mv ${BOOT_KEY} ${PRIVATE_KEY}
    sudo mount -o remount,ro ${BOOT_DIR}
    sudo chown jaia:jaia ${PRIVATE_KEY}
    chmod 700 ${PRIVATE_KEY}
fi

CONF=$(mktemp)
trap 'rm -f ${CONF}' EXIT

if [ ! -e ${WG_DIR}/privatekey ] || [ ! -e ${WG_DIR}/publickey ]; then
    sudo bash -c "umask 077; wg genkey | tee ${WG_DIR}/privatekey | wg pubkey > ${WG_DIR}/publickey"
fi

# The CloudHub is told the public half only, and answers with a config whose
# PrivateKey is a placeholder, so this node's key never leaves it. Bounded, because
# a CloudHub not open for pairing drops the connection rather than refusing it.
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i ${PRIVATE_KEY} \
    jaia@${CLOUDHUB_HOST} "$type $id $(sudo cat ${WG_DIR}/publickey)" > ${CONF}

if ! grep -q "^PrivateKey = ${PLACEHOLDER}\$" ${CONF}; then
    echo "${CLOUDHUB_HOST} did not return a usable Wireguard config for ${type} ${id}" >&2
    exit 1
fi

sed -i "s|^PrivateKey =.*|PrivateKey = $(sudo cat ${WG_DIR}/privatekey)|" ${CONF}
sudo install -m 600 ${CONF} ${WG_CONF}

# Spent only now: a run that could not enroll leaves the key where this one
# found it, so the node can be made to try again without being re-imaged. And
# before the tunnel is brought up rather than after, so a tunnel that will not
# start is retried on its own next time, not by enrolling again.
rm -f ${PRIVATE_KEY}

# Started now only if it is set to start at boot: whether the tunnel comes up by
# itself is the fleet config's choice, made at first boot, and pairing leaves it be
if sudo systemctl is-enabled --quiet wg-quick@${WG_PROFILE}; then
    sudo systemctl restart wg-quick@${WG_PROFILE}
    echo "Paired with ${CLOUDHUB_HOST}"
else
    echo "Paired with ${CLOUDHUB_HOST}; the CloudHub VPN is not set to start at boot, so it is left stopped"
fi
