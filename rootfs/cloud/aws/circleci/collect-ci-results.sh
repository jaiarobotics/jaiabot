#!/bin/bash

# Pulls the trial's results and logs back off the CloudHub. Runs after a failed trial as
# well as a passing one, so every step is best effort.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>       Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --bots <n>        Number of bots (default: 2)
  --output-dir <s>  Where to collect into (default: /tmp/sea-trial)
EOF
    exit 1
}

set -u

FLEET="${JAIA_CI_FLEET:-9}"
BOTS=2
OUTPUT_DIR=/tmp/sea-trial

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

script_dir=$(dirname "$(realpath "$0")")
CLOUDHUB="cloudhub-fleet${FLEET}"
SSH_RSYNC=(-a -e "ssh -o StrictHostKeyChecking=no")

mkdir -p "${OUTPUT_DIR}"

# the VirtualFleet is only reachable from the CloudHub, and a bot's own debug logs are
# text, which the offload excludes, so they come from here
rsync "${SSH_RSYNC[@]}" "${script_dir}/collect-fleet-logs.sh" "jaia@${CLOUDHUB}:/tmp/" || true
ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" \
    "/tmp/collect-fleet-logs.sh --fleet ${FLEET} --bots ${BOTS} ${OUTPUT_DIR}/fleet-logs" || true

rsync "${SSH_RSYNC[@]}" "jaia@${CLOUDHUB}:${OUTPUT_DIR}/" "${OUTPUT_DIR}/" || true
ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" \
    "sudo journalctl -n 2000 --no-pager" > "${OUTPUT_DIR}/cloudhub-journal.txt" 2>&1 || true
