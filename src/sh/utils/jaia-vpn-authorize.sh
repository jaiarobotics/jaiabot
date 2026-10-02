#!/bin/bash

# Authorizes the fleet's bootstrap SSH key for VPN enrollment and nothing else.
#
# This line is the whole of what that key can do, so it is written in one place
# rather than by each caller: the CloudHub's cloud-init at first boot, and
# 'jaia admin fleet vpn_authorize' when the authorization has to be renewed.

set -u -e

AUTHORIZED_KEYS="${JAIA_TMP_AUTHORIZED_KEYS:-/etc/jaiabot/ssh/tmp_authorized_keys}"
ENROLL_COMMAND="/usr/bin/jaia-vpn-enroll.sh"

usage()
{
    cat >&2 <<EOF
Usage: ${0##*/} <ssh public key> [days valid]
       ${0##*/} --rm <ssh public key>

Authorizes <ssh public key> on this CloudHub to run ${ENROLL_COMMAND} and
nothing else, for the given number of days (30 by default).
EOF
    exit 1
}

remove=false
if [ "${1:-}" = "--rm" ]; then
    remove=true
    shift
fi

[ $# -ge 1 ] && [ $# -le 2 ] || usage
pubkey=$1
days=${2:-30}

# ssh-keygen also accepts a line carrying options, which would put whatever they
# say into the file ahead of the ones below, so the type has to lead.
case "${pubkey}" in
    ssh-* | ecdsa-* | sk-ssh-* | sk-ecdsa-*) ;;
    *)
        echo "ERROR: '${pubkey}' does not begin with an SSH public key type" >&2
        exit 1
        ;;
esac
if ! echo "${pubkey}" | ssh-keygen -l -f - >/dev/null 2>&1; then
    echo "ERROR: '${pubkey}' is not an SSH public key" >&2
    exit 1
fi

# The blob alone identifies the key; the comment after it may differ
blob=$(echo "${pubkey}" | awk '{print $2}')

mkdir -p "$(dirname "${AUTHORIZED_KEYS}")"
touch "${AUTHORIZED_KEYS}"
chmod 600 "${AUTHORIZED_KEYS}"

# Only this key's entry: the file also holds the temporary keys of whoever
# 'jaia admin ssh add' has let in. Dropping it first makes renewing a renewal
# rather than a second, still-expired entry.
sed -i "\|${blob}|d" "${AUTHORIZED_KEYS}"

if [ "${remove}" = true ]; then
    echo "Removed VPN enrollment authorization for ${blob}"
    exit 0
fi

case "$days" in
    "" | *[!0-9]*)
        echo "ERROR: '${days}' is not a number of days" >&2
        exit 1
        ;;
esac

expiry=$(date -u -d "+${days} days" +%Y%m%d)
echo "restrict,expiry-time=\"${expiry}\",command=\"${ENROLL_COMMAND}\" ${pubkey}" \
    >> "${AUTHORIZED_KEYS}"
echo "Authorized VPN enrollment until ${expiry}"
