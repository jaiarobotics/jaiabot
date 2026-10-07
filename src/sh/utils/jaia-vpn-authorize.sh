#!/bin/bash

# Authorizes the fleet's bootstrap SSH key for VPN enrollment and nothing else.
#
# This line is the whole of what that key can do, so it is written in one place
# rather than by each caller. Its one caller is jaia-support-access.py, which
# rewrites it on every run from the fleet pairing record so that it outlives a
# reboot and ends when pairing does.

set -u -e

AUTHORIZED_KEYS="${JAIA_TMP_AUTHORIZED_KEYS:-/etc/jaiabot/ssh/tmp_authorized_keys}"
ENROLL_COMMAND="/usr/bin/jaia-vpn-enroll.sh"

usage()
{
    cat >&2 <<EOF
Usage: ${0##*/} --until <unix time> <ssh public key>
       ${0##*/} --rm <ssh public key>

Authorizes <ssh public key> on this CloudHub to run ${ENROLL_COMMAND} and
nothing else, until the given time.
EOF
    exit 1
}

remove=false
until=""
case "${1:-}" in
    --rm) remove=true; shift ;;
    --until) until="${2:-}"; shift 2 || usage ;;
    *) usage ;;
esac

[ $# -eq 1 ] || usage
pubkey=$1

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
# sshd reads this file as the user logging in, and both touch and sed -i leave it
# owned by whoever runs this (root, from the reconcile timer)
chown --reference="$(dirname "${AUTHORIZED_KEYS}")" "${AUTHORIZED_KEYS}"

if [ "${remove}" = true ]; then
    echo "Removed VPN enrollment authorization for ${blob}"
    exit 0
fi

case "$until" in
    "" | *[!0-9]*)
        echo "ERROR: '${until}' is not a unix time" >&2
        exit 1
        ;;
esac

# To the second and in UTC: a bare date is read by sshd as midnight at the start of
# that day, so one written late in the day would lapse within minutes
expiry=$(date -u -d "@${until}" +%Y%m%d%H%M%SZ)
echo "restrict,expiry-time=\"${expiry}\",command=\"${ENROLL_COMMAND}\" ${pubkey}" \
    >> "${AUTHORIZED_KEYS}"
echo "Authorized VPN enrollment until ${expiry}"
