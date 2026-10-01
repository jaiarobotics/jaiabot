#!/bin/bash

set -u -e -o pipefail

CLOUDHUB_HOST=${1:-}

# Overridable so this can be run against directories other than the live ones.
BOOT_DIR="${JAIA_BOOT_DIR:-/boot/firmware}"
SSH_DIR="${JAIA_SSH_DIR:-/home/jaia/.ssh}"
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"
DEBCONF_SH="${JAIA_DEBCONF_SH:-/usr/bin/jaia-debconf.sh}"

PRIVATE_KEY=${BOOT_DIR}/jaiabot/init/id_vpn_tmp

# What the CloudHub leaves in the config in place of a key it never holds
PLACEHOLDER="REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

if [ -z "${CLOUDHUB_HOST}" ]; then
    echo "No CloudHub given, not configuring Wireguard service VPN"
    exit 0
fi

if [ ! -e "${PRIVATE_KEY}" ]; then
    echo "No ${PRIVATE_KEY} private key provided, not configuring Wireguard service VPN"
    exit 0
fi

if ! timeout 10 bash -c "until ping -c1 1.1.1.1 >/dev/null 2>&1; do :; done"; then
    echo "No network after 10 seconds, not configuring Wireguard server VPN"
    exit 1
fi

sudo mount -o remount,rw ${BOOT_DIR}
sudo mv ${PRIVATE_KEY} ${SSH_DIR}/
sudo mount -o remount,ro ${BOOT_DIR}
PRIVATE_KEY=${SSH_DIR}/id_vpn_tmp
sudo chown jaia:jaia ${PRIVATE_KEY}
chmod 700 ${PRIVATE_KEY}

CONF=$(mktemp)
# The bootstrap key is good for one enrollment, so it goes whether this run
# succeeds or not, rather than staying behind on a node that failed to enroll.
trap 'rm -f ${CONF} ${PRIVATE_KEY}' EXIT

source ${DEBCONF_SH}

type=$(jaia_debconf_get type)
fleet=$(jaia_debconf_get fleet_id)
id=$(jaia_debconf_node_id)

WG_PROFILE=wg_jaia_ch${fleet}

if [ ! -e ${WG_DIR}/privatekey ] || [ ! -e ${WG_DIR}/publickey ]; then
    sudo bash -c "umask 077; wg genkey | tee ${WG_DIR}/privatekey | wg pubkey > ${WG_DIR}/publickey"
fi

# The CloudHub is told the public half only, and answers with a config whose
# PrivateKey is a placeholder, so this node's key never leaves it.
ssh -o StrictHostKeyChecking=accept-new -i ${PRIVATE_KEY} \
    jaia@${CLOUDHUB_HOST} "$type $id $(sudo cat ${WG_DIR}/publickey)" > ${CONF}

if ! grep -q "^PrivateKey = ${PLACEHOLDER}\$" ${CONF}; then
    echo "${CLOUDHUB_HOST} did not return a usable Wireguard config for ${type} ${id}" >&2
    exit 1
fi

sed -i "s|^PrivateKey =.*|PrivateKey = $(sudo cat ${WG_DIR}/privatekey)|" ${CONF}
sudo install -m 600 ${CONF} ${WG_DIR}/${WG_PROFILE}.conf
