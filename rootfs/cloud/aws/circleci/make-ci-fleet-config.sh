#!/bin/bash

# Writes a fleet config for a CI fleet, with SSH keys generated fresh for this run.
#
# `jaia admin fleet create` is interactive, and a checked-in config would mean checked-in
# private keys, so CI generates both here and throws them away with the fleet.

usage() {
    cat <<EOF
Usage: $0 [options] <output path>

  --fleet <n>           Fleet ID (default: 9)
  --bots <n>            Number of bots (default: 2)
  --warp <n>            Simulator warp (default: 5)
  --authorized-key <s>  Public key to install on every node; repeatable. Defaults to
                        ~/.ssh/id_ed25519.pub, generating it if it does not exist.
EOF
    exit 1
}

set -u -e

FLEET=9
BOTS=2
WARP=5
AUTHORIZED_KEYS=()
OUTPUT=""

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --warp) WARP="${2:-}"; shift 2 ;;
        --authorized-key) AUTHORIZED_KEYS+=("${2:-}"); shift 2 ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage ;;
        *) [[ -z "$OUTPUT" ]] || usage; OUTPUT="$1"; shift ;;
    esac
done

[[ -n "$OUTPUT" ]] || usage

CLOUDHUB_ID=$(jaia_bounds --cloudhub_id)
VIRTUALHUB_ID=1

if (( ${#AUTHORIZED_KEYS[@]} == 0 )); then
    if [[ ! -f "${HOME}/.ssh/id_ed25519.pub" ]]; then
        mkdir -p "${HOME}/.ssh"
        ssh-keygen -q -t ed25519 -N '' -C "jaia-ci-fleet${FLEET}" -f "${HOME}/.ssh/id_ed25519"
    fi
    AUTHORIZED_KEYS+=("$(cat "${HOME}/.ssh/id_ed25519.pub")")
fi

KEYDIR=$(mktemp -d)
trap 'rm -rf "$KEYDIR"' EXIT

# Textproto keeps a private key on one line, so the newlines are escaped rather than literal
function generate_key() {
    local name=$1
    ssh-keygen -q -t ed25519 -N '' -C "${name}_fleet${FLEET}" -f "${KEYDIR}/${name}"
}

function escaped_private_key() {
    awk '{printf "%s\\n", $0}' "${KEYDIR}/$1"
}

generate_key "hub${VIRTUALHUB_ID}"
generate_key "hub${CLOUDHUB_ID}"
generate_key "vpn_tmp"

{
    echo "fleet: ${FLEET}"
    echo "hubs: [${VIRTUALHUB_ID}, ${CLOUDHUB_ID}]"
    echo "bots: [$(seq -s', ' 1 "${BOTS}")]"
    echo "ssh {"
    for key in "${AUTHORIZED_KEYS[@]}"; do
        echo "  permanent_authorized_keys: \"${key}\""
    done
    for id in "${VIRTUALHUB_ID}" "${CLOUDHUB_ID}"; do
        echo "  hub {"
        echo "    id: ${id}"
        echo "    private_key: \"$(escaped_private_key "hub${id}")\""
        echo "    public_key: \"$(cat "${KEYDIR}/hub${id}.pub")\""
        echo "  }"
    done
    echo "  vpn_tmp {"
    echo "    private_key: \"$(escaped_private_key vpn_tmp)\""
    echo "    public_key: \"$(cat "${KEYDIR}/vpn_tmp.pub")\""
    echo "  }"
    echo "}"
    echo "wlan_password: \"$(head -c 18 /dev/urandom | base64 | tr -d '/+=')\""
    echo "service_vpn_enabled: false"
    echo "debconf {"
    echo "  key: \"jaiabot-embedded/warp\""
    echo "  type: SELECT"
    echo "  value: \"${WARP}\""
    echo "}"
    echo "debconf {"
    echo "  key: \"jaiabot-embedded/comms_links\""
    echo "  type: MULTISELECT"
    echo "  value: \"wifi\""
    echo "}"
} > "${OUTPUT}"

chmod 600 "${OUTPUT}"
echo "Wrote fleet ${FLEET} config for ${BOTS} bot(s) at warp ${WARP} to ${OUTPUT}"
