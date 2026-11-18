#!/bin/bash

# Joins the VirtualHubs to the CloudHub over hub-to-hub, as a fleet's hubs and its
# CloudHub are, so the trial can command the fleet through any of them. Run after the
# VirtualFleet is raised.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>  Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --hubs <n>   Number of VirtualHubs (default: 2)
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"
HUBS=2

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --hubs) HUBS="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

script_dir=$(dirname "$(realpath "$0")")
CLOUDHUB="cloudhub-fleet${FLEET}"

scp -o StrictHostKeyChecking=no "${script_dir}/enroll-virtualhub.sh" "jaia@${CLOUDHUB}:/tmp/"
for (( hub_id = 1; hub_id <= HUBS; hub_id++ )); do
    ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" "bash /tmp/enroll-virtualhub.sh ${FLEET} ${hub_id}"
done
