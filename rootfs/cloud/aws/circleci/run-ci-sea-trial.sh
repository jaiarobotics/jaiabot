#!/bin/bash

# Sends the VirtualFleet on its dive mission, driven from the CloudHub because that is
# what reaches it.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>       Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --bots <n>        Number of bots (default: 2)
  --goals <n>       Goals per mission (default: 2)
  --warp <n>        Simulator warp (default: 5)
  --output-dir <s>  Results directory on the CloudHub (default: /tmp/sea-trial)
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"
BOTS=2
GOALS=2
WARP=5
OUTPUT_DIR=/tmp/sea-trial

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --goals) GOALS="${2:-}"; shift 2 ;;
        --warp) WARP="${2:-}"; shift 2 ;;
        --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

script_dir=$(dirname "$(realpath "$0")")
repo_root=$(realpath "${script_dir}/../../../..")
CLOUDHUB="cloudhub-fleet${FLEET}"

rsync -a -e "ssh -o StrictHostKeyChecking=no" \
    "${repo_root}/scripts/test/e2e/" "jaia@${CLOUDHUB}:/tmp/e2e/"

# the CloudHub's ssh config keys the VirtualFleet identity off the VPN address range, so
# the offload check has to address the hub by address. The offloaded logs stay on the
# VirtualHub that pulled them, so that check reads its directory over ssh.
HUB_ADDR=$(ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" \
    "jaia_ip --query_type addr --node_type hub --ip_net vfleet_vpn \
       --fleet_id ${FLEET} --node_id 1")
echo "VirtualHub 1 is at ${HUB_ADDR}"

ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" \
    "python3 /tmp/e2e/jaia-sea-trial.py \
       --hub-url http://hub1-virtualfleet${FLEET} \
       --bots ${BOTS} --goals ${GOALS} --warp ${WARP} \
       --offload-host jaia@${HUB_ADDR} \
       --offload-dir /var/log/jaiabot/bot_offload \
       --output-dir ${OUTPUT_DIR}"
