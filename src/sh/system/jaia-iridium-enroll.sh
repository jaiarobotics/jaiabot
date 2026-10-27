#!/bin/bash

# Joins this server (iridium.jaia.tech) to one fleet's CloudHub VPN and starts that
# fleet's Iridium tunnels. Run it as root while Fleet Pairing is open on the CloudHub.

set -u -e

PAIRING_PORT="${JAIA_PAIRING_PORT:-2222}"
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"

usage()
{
    echo "Usage: $0 <fleet id> <CloudHub base URI> <bootstrap key file>" >&2
    echo >&2
    echo "The bootstrap key is the fleet's id_vpn_tmp, from a workstation holding the fleet config:" >&2
    echo "  jaia admin fleet generate fleet<id>.cfg hub 1 --action vpn_key --bootdir <dir>" >&2
    echo "writes it to <dir>/jaiabot/init/id_vpn_tmp. Delete the copy here once this has run." >&2
    exit 1
}

[ $# -eq 3 ] || usage
fleet=$1
host=$2
bootstrap_key=$3
case "${fleet}" in
    "" | *[!0-9]*) usage ;;
esac
[ -r "${bootstrap_key}" ] || { echo "ERROR: cannot read ${bootstrap_key}" >&2; exit 1; }

iface=wg_jaia_ch${fleet}
conf=${WG_DIR}/${iface}.conf
# Its own key for each fleet, so one fleet's tunnel can be replaced without the others'
private_key=${WG_DIR}/${iface}.key

umask 077
tmp=$(mktemp -d)
trap 'rm -rf "${tmp}"' EXIT
install -m 600 "${bootstrap_key}" "${tmp}/id_vpn_tmp"

[ -s "${private_key}" ] || wg genkey > "${private_key}"
pubkey=$(wg pubkey < "${private_key}")

# A rebuilt CloudHub has a new host key
ssh-keygen -R "[${host}]:${PAIRING_PORT}" >/dev/null 2>&1 || true
if ! ssh -p "${PAIRING_PORT}" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
        -o ConnectTimeout=15 -i "${tmp}/id_vpn_tmp" "jaia@${host}" "iridium ${pubkey}" > "${tmp}/answer"; then
    echo "ERROR: ${host} did not enroll this server. Is Fleet Pairing open on its JCU?" >&2
    exit 1
fi
if ! grep -q '^\[Interface\]' "${tmp}/answer" || ! grep -q '^PrivateKey *=' "${tmp}/answer"; then
    echo "ERROR: ${host} did not answer with a WireGuard config" >&2
    exit 1
fi

# Read from its file, so the private key is never on a command line or in a log
awk -v keyfile="${private_key}" \
    '/^PrivateKey *=/ { getline key < keyfile; print "PrivateKey = " key; next } { print }' \
    "${tmp}/answer" > "${tmp}/conf"
install -m 600 "${tmp}/conf" "${conf}"

systemctl enable "wg-quick@${iface}"
systemctl restart "wg-quick@${iface}"
systemctl enable "jaiabot__iridium_fleet@${fleet}"
systemctl restart "jaiabot__iridium_fleet@${fleet}"

echo "Enrolled on fleet ${fleet}'s CloudHub VPN as $(sed -n 's|^Address *= *||p' "${conf}")"
