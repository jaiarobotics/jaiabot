#!/bin/bash

# Stages a replacement iridium.jaia.tech: copies the fleet tunnels and the Iridium
# settings from the running server to the new one, and checks each relay finds its
# CloudHub. Every tunnel and relay on the new server stays stopped: a tunnel running on
# both servers at once would have the CloudHub switch endpoints between them, so they
# start only at the cutover, after the Elastic IP has moved.

set -u -e -o pipefail

OLD_HOST=iridium.jaia.tech
INCLUDE_RELEASE_3=false
# Overridable so this can be run against directories other than the live ones
OLD_ETC="${JAIA_OLD_ETC:-/etc}"
NEW_ETC="${JAIA_NEW_ETC:-/etc}"

usage()
{
    echo "Usage: $0 [--old <host>] [--include-release-3] <new host> [fleet id ...]" >&2
    echo >&2
    echo "Copies the tunnels of the given fleets (all of them if none is given) from the old" >&2
    echo "server (default ${OLD_HOST}) to the new one. Release 3 fleets are left out unless" >&2
    echo "--include-release-3 is given: they enroll on the new server with jaia-iridium-enroll.sh." >&2
    exit 1
}

fail()
{
    echo "ERROR: $*" >&2
    exit 1
}

while [ $# -gt 0 ]; do
    case "$1" in
        --old) [ $# -ge 2 ] || usage; OLD_HOST=$2; shift 2 ;;
        --include-release-3) INCLUDE_RELEASE_3=true; shift ;;
        -h | --help) usage ;;
        -*) usage ;;
        *) break ;;
    esac
done
[ $# -ge 1 ] || usage
NEW_HOST=$1
shift
requested=("$@")
for fleet in ${requested[@]+"${requested[@]}"}; do
    case "${fleet}" in
        "" | *[!0-9]*) fail "'${fleet}' is not a fleet id" ;;
    esac
done
[ "${OLD_HOST}" != "${NEW_HOST}" ] || fail "the old and new servers are the same host"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)
on_old() { ssh "${SSH_OPTS[@]}" "jaia@${OLD_HOST}" "$@"; }
on_new() { ssh "${SSH_OPTS[@]}" "jaia@${NEW_HOST}" "$@"; }

echo ">>> Checking ${NEW_HOST}"
on_new "jaia_bounds --iridium_id >/dev/null && command -v jaia-iridium-tunnel.sh >/dev/null && command -v jaia-iridium-enroll.sh >/dev/null" \
    || fail "${NEW_HOST} does not have the release 3 iridium scripts (jaiabot-apps from 3.y)"
running=$(on_new "systemctl list-units --state=active --plain --no-legend 'wg-quick@wg_jaia_ch*' 'jaiabot__iridium_fleet@*' | cut -d' ' -f1")
[ -z "${running}" ] || fail "${NEW_HOST} already runs fleet units (${running//$'\n'/ }); stop them before staging"

iridium_host=$(printf '%x' "$(on_new "jaia_bounds --iridium_id")")

echo ">>> Reading the fleets on ${OLD_HOST}"
declare -A address
available=()
for name in $(on_old "sudo ls ${OLD_ETC}/wireguard"); do
    [[ "${name}" =~ ^wg_jaia_ch([0-9]+)\.conf$ ]] || continue
    fleet=${BASH_REMATCH[1]}
    address[${fleet}]=$(on_old "sudo sed -n 's|^Address *= *\\([^/]*\\).*|\\1|p' ${OLD_ETC}/wireguard/${name}" | head -1)
    available+=("${fleet}")
done
[ ${#available[@]} -gt 0 ] || fail "${OLD_HOST} has no fleet tunnels in ${OLD_ETC}/wireguard"

release_of()
{
    case "${address[$1]}" in
        *::1:${iridium_host}) echo 3 ;;
        *::${iridium_host}) echo 2 ;;
        *) echo unknown ;;
    esac
}

[ ${#requested[@]} -gt 0 ] || requested=("${available[@]}")
fleets=()
for fleet in "${requested[@]}"; do
    [ -n "${address[${fleet}]+set}" ] || fail "${OLD_HOST} has no tunnel for fleet ${fleet}"
    case "$(release_of "${fleet}")" in
        2) fleets+=("${fleet}") ;;
        3)
            if [ "${INCLUDE_RELEASE_3}" = true ]; then
                fleets+=("${fleet}")
            else
                echo "    fleet ${fleet} is release 3: left out, enroll it with jaia-iridium-enroll.sh"
            fi
            ;;
        *) fail "fleet ${fleet}'s tunnel address '${address[${fleet}]}' is not hub $((16#${iridium_host}))'s" ;;
    esac
done
[ ${#fleets[@]} -gt 0 ] || fail "no fleets to stage"
mapfile -t fleets < <(printf '%s\n' "${fleets[@]}" | sort -n)

files=()
for fleet in "${fleets[@]}"; do
    files+=("wireguard/wg_jaia_ch${fleet}.conf")
done
# The old shared key, for a release 2 fleet added by hand later, and the Iridium settings
for file in wireguard/privatekey wireguard/publickey jaiabot/iridium.json; do
    if on_old "sudo test -e ${OLD_ETC}/${file}"; then
        files+=("${file}")
    fi
done

echo ">>> Copying ${#files[@]} files from ${OLD_HOST} to ${NEW_HOST}"
# Streamed root to root, so no key is ever on a command line or in a log
on_old "sudo tar -C ${OLD_ETC} -cf - ${files[*]}" \
    | on_new "sudo mkdir -p -m 700 ${NEW_ETC}/wireguard && sudo mkdir -p ${NEW_ETC}/jaiabot && sudo tar -C ${NEW_ETC} -xf - && sudo chmod 700 ${NEW_ETC}/wireguard && sudo chmod 600 ${NEW_ETC}/wireguard/*"
for file in "${files[@]}"; do
    echo "    ${file}"
done

echo ">>> Checking each relay on ${NEW_HOST} finds its CloudHub"
for fleet in "${fleets[@]}"; do
    cloudhub=$(on_new "sudo JAIA_WG_DIR=${NEW_ETC}/wireguard jaia-iridium-tunnel.sh ${fleet} --cloudhub-address") \
        || fail "the relay for fleet ${fleet} does not find its CloudHub"
    printf '    fleet %-4s release %s  CloudHub %s\n' "${fleet}" "$(release_of "${fleet}")" "${cloudhub}"
done

cat <<EOF

Staged on ${NEW_HOST}, with every tunnel and relay stopped. At the cutover:

  1. On ${OLD_HOST}:
       sudo systemctl disable --now 'jaiabot__iridium_fleet@*' 'wg-quick@wg_jaia_ch*'
  2. Move the Elastic IP to ${NEW_HOST}'s instance (aws ec2 associate-address --allow-reassociation).
  3. On ${NEW_HOST}:
       for f in ${fleets[*]}; do sudo systemctl enable --now wg-quick@wg_jaia_ch\$f jaiabot__iridium_fleet@\$f; done
EOF
