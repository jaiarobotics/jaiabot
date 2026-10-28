#!/bin/bash

set -u -e -o pipefail

# Overridable so this can be run against directories other than the live ones.
BOOT_DIR="${JAIA_BOOT_DIR:-/boot/firmware}"
SSH_DIR="${JAIA_SSH_DIR:-/home/jaia/.ssh}"
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"
DEBCONF_SH="${JAIA_DEBCONF_SH:-/usr/bin/jaia-debconf.sh}"
HOST_FILE="${JAIA_CLOUDHUB_HOST_FILE:-/etc/jaiabot/cloudhub_host}"
PORTAL_UNIT="${JAIA_PORTAL_UNIT:-jaiabot_goby_intervehicle_portal}"
FLEET_CFG_DIR="${JAIA_FLEET_CFG_DIR:-/etc/jaiabot}"
HUB_KEYS_FILE="${JAIA_HUB_KEYS_FILE:-/etc/jaiabot/ssh/hub_authorized_keys}"
# PersistentKeepalive keeps a live tunnel handshaking every two minutes or so
STALE_SECONDS="${JAIA_TUNNEL_STALE_SECONDS:-300}"
PAIRING_PORT="${JAIA_PAIRING_PORT:-2222}"

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

# Whether the CloudHub can be reached the way pairing reaches it, over TCP, rather than
# by a ping some networks block. Its HTTPS port answers whether or not pairing is open.
wait_for_cloudhub()
{
    local wait_seconds="${JAIA_PAIRING_WAIT_SECONDS:-120}"
    local deadline=$((SECONDS + wait_seconds))
    until nc -z -w 5 "${CLOUDHUB_HOST}" 443 >/dev/null 2>&1; do
        if (( SECONDS >= deadline )); then
            echo "Could not reach ${CLOUDHUB_HOST} (TCP port 443) within ${wait_seconds} seconds, not pairing" >&2
            exit 1
        fi
        sleep 2
    done
}

# A tunnel someone stopped, or that does not start at boot, says nothing about the
# CloudHub, so only a running one that has stopped handshaking counts as stale
tunnel_is_stale()
{
    systemctl is-active --quiet wg-quick@${WG_PROFILE} || return 1
    local now handshake started
    now=$(date +%s)
    handshake=$(sudo wg show ${WG_PROFILE} latest-handshakes 2>/dev/null | awk '{print $2; exit}')
    if [ -n "${handshake}" ] && [ "${handshake}" != 0 ]; then
        (( now - handshake > STALE_SECONDS ))
        return
    fi
    started=$(systemctl show -p ActiveEnterTimestamp --value wg-quick@${WG_PROFILE} 2>/dev/null || true)
    [ -n "${started}" ] && started=$(date -d "${started}" +%s 2>/dev/null) || return 1
    (( now - started > STALE_SECONDS ))
}

# The CloudHub's own SSH key, as an authorized_keys line restricted to its VPN address:
# it replaces the one this node was imaged with, which a rebuilt CloudHub no longer holds
accept_cloudhub_ssh_key()
{
    local line=$1 from key tmp
    if ! [[ "${line}" =~ ^from=\"([0-9A-Fa-f:.]+)\"\ ((sk-)?(ssh|ecdsa)-[a-z0-9@.-]+\ [A-Za-z0-9+/=]+)(\ [^[:space:]]+)?$ ]]; then
        echo "Ignoring the SSH key ${CLOUDHUB_HOST} sent: not an authorized_keys line for one address" >&2
        return 0
    fi
    from=${BASH_REMATCH[1]}
    key=${BASH_REMATCH[2]}
    if [ -f "${HUB_KEYS_FILE}" ] && grep -qF -- "${key}" "${HUB_KEYS_FILE}"; then
        return 0
    fi
    tmp=$(mktemp)
    { [ ! -f "${HUB_KEYS_FILE}" ] || grep -v "^from=\"${from}\" " "${HUB_KEYS_FILE}" || true; echo "${line}"; } > "${tmp}"
    sudo install -m 644 "${tmp}" "${HUB_KEYS_FILE}"
    rm -f "${tmp}"
    echo "Accepted ${CLOUDHUB_HOST}'s SSH key: its fleet actions reach this ${type} again"
}

REPAIRING=false
if [ ! -e "${BOOT_KEY}" ] && [ ! -e "${PRIVATE_KEY}" ]; then
    if [ ! -e "${WG_CONF}" ]; then
        echo "Not paired, and no bootstrap key (id_vpn_tmp) to pair with"
        exit 0
    fi
    # Paired already, and the key that did it spent: nothing to do, which is what
    # makes this safe to run on every node in a fleet
    if ! tunnel_is_stale; then
        echo "Already paired with ${CLOUDHUB_HOST}"
        exit 0
    fi
    # Reachable but no longer answering the tunnel: the CloudHub was replaced (a rebuild,
    # say), so pair again with the bootstrap key from this node's own fleet config
    wait_for_cloudhub
    echo "The tunnel to ${CLOUDHUB_HOST} has not handshaken in over ${STALE_SECONDS} seconds; pairing again"
    stored_cfg=${FLEET_CFG_DIR}/fleet${fleet}.cfg
    if [ ! -r "${stored_cfg}" ]; then
        echo "Cannot pair ${type} ${id} again: no ${stored_cfg} to take the fleet's bootstrap key from." \
             "Put id_vpn_tmp ('jaia admin fleet generate … --action vpn_key') in ${BOOT_DIR}/jaiabot/init and run this again" >&2
        exit 1
    fi
    keydir=$(mktemp -d)
    trap 'rm -rf ${keydir}' EXIT
    mkdir -p ${keydir}/jaiabot/init
    if ! jaia admin fleet generate "${stored_cfg}" ${type} ${id} --action vpn_key --bootdir ${keydir} >/dev/null 2>&1 \
        || [ ! -s ${keydir}/jaiabot/init/id_vpn_tmp ]; then
        echo "Cannot pair ${type} ${id} again: could not take the bootstrap key from ${stored_cfg}" >&2
        exit 1
    fi
    install -m 600 ${keydir}/jaiabot/init/id_vpn_tmp ${PRIVATE_KEY}
    sudo chown jaia:jaia ${PRIVATE_KEY}
    rm -rf ${keydir}
    trap - EXIT
    REPAIRING=true
else
    wait_for_cloudhub
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

# A CloudHub that was replaced comes back under the same name with a new host key,
# and pairing again is the deliberate step that accepts it
if [ -e "${WG_CONF}" ] || ${REPAIRING}; then
    ssh-keygen -R "${CLOUDHUB_HOST}" >/dev/null 2>&1 || true
    ssh-keygen -R "[${CLOUDHUB_HOST}]:${PAIRING_PORT}" >/dev/null 2>&1 || true
fi

# The CloudHub is told the public half only, and answers with a config whose
# PrivateKey is a placeholder, so this node's key never leaves it. Bounded, because
# a CloudHub not open for pairing drops the connection rather than refusing it.
SSH_ERR=$(mktemp)
trap 'rm -f ${CONF} ${SSH_ERR}' EXIT
enroll()
{
    ssh -p "$1" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i ${PRIVATE_KEY} \
        jaia@${CLOUDHUB_HOST} "$type $id $(sudo cat ${WG_DIR}/publickey)" > ${CONF} 2> ${SSH_ERR}
}
# A CloudHub from before the pairing port enrolled on 22: one that refuses the pairing
# port or never answers on it is asked there instead
if ! { enroll "${PAIRING_PORT}" \
       || { grep -qiE "connection refused|timed out" ${SSH_ERR} && enroll 22; }; }; then
    if grep -qiE "host key verification failed|remote host identification has changed" ${SSH_ERR}; then
        echo "${CLOUDHUB_HOST}'s SSH host key is not the one this node recorded for it, so ${type} ${id}" \
             "was not paired. If the CloudHub was replaced, remove the old key" \
             "(ssh-keygen -R ${CLOUDHUB_HOST}) and pair again" >&2
    else
        # The CloudHub answered on 443 just now, so this is pairing, not the network
        echo "${CLOUDHUB_HOST} did not accept ${type} ${id} for pairing: is fleet pairing open on its JCU?" >&2
    fi
    sed 's/^/  ssh: /' ${SSH_ERR} >&2
    exit 1
fi

if ! grep -q "^PrivateKey = ${PLACEHOLDER}\$" ${CONF}; then
    echo "${CLOUDHUB_HOST} did not return a usable Wireguard config for ${type} ${id}" >&2
    exit 1
fi

CLOUDHUB_SSH_KEY=$(sed -n 's/^# jaia-cloudhub-ssh-key: //p' ${CONF} | head -1)
sed -i '/^# jaia-cloudhub-ssh-key: /d' ${CONF}
sed -i "s|^PrivateKey =.*|PrivateKey = $(sudo cat ${WG_DIR}/privatekey)|" ${CONF}
sudo install -m 600 ${CONF} ${WG_CONF}

# Spent only now: a run that could not enroll leaves the key where this one
# found it, so the node can be made to try again without being re-imaged. And
# before the tunnel is brought up rather than after, so a tunnel that will not
# start is retried on its own next time, not by enrolling again.
rm -f ${PRIVATE_KEY}

if [ -n "${CLOUDHUB_SSH_KEY}" ]; then
    accept_cloudhub_ssh_key "${CLOUDHUB_SSH_KEY}"
fi

# Started now only if it is set to start at boot: whether the tunnel comes up by
# itself is the fleet config's choice, made at first boot, and pairing leaves it be
if sudo systemctl is-enabled --quiet wg-quick@${WG_PROFILE}; then
    sudo systemctl restart wg-quick@${WG_PROFILE}
    # A hub's HUB2HUB link only comes up if the tunnel exists when the portal starts,
    # which it does not when pairing happens after boot (e.g. after a major upgrade)
    if [ "$type" = "hub" ] && systemctl is-active --quiet ${PORTAL_UNIT}; then
        sudo systemctl restart ${PORTAL_UNIT}
    fi
    echo "Paired with ${CLOUDHUB_HOST}"
else
    echo "Paired with ${CLOUDHUB_HOST}; the CloudHub VPN is not set to start at boot, so it is left stopped"
fi
