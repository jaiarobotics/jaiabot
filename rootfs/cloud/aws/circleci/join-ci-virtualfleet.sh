#!/bin/bash

# Joins the VirtualHub to the CloudHub over hub-to-hub, as a field hub and its CloudHub
# are, so the trial can command the fleet through either one. Run after the VirtualFleet
# is raised.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>  Fleet ID (default: \$JAIA_CI_FLEET, else 9)
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

script_dir=$(dirname "$(realpath "$0")")
CLOUDHUB="cloudhub-fleet${FLEET}"

scp -o StrictHostKeyChecking=no "${script_dir}/enroll-virtualhub.sh" "jaia@${CLOUDHUB}:/tmp/"
ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" "bash /tmp/enroll-virtualhub.sh ${FLEET} 1"
