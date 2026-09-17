#!/bin/bash

# Raises the VirtualFleet from the CloudHub, using the playbooks that shipped with the
# image under test.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>  Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --bots <n>   Number of bots (default: 2)
  --warp <n>   Simulator warp (default: 5)
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"
BOTS=2
WARP=5

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --warp) WARP="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

CLOUDHUB="cloudhub-fleet${FLEET}"
THIS_HUB="hub$(jaia_bounds --cloudhub_id)-fleet${FLEET}"

# the playbooks target `all`, so without the inventory and limit the prelaunch liaison
# passes they match nothing and the play is skipped with a zero exit
ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" \
    "cd /usr/share/jaiabot/config/ansible && ansible-playbook cloud/create-virtualfleet.yml \
       -i /etc/jaiabot/inventory.yml --limit ${THIS_HUB} \
       -e n_bots=${BOTS} -e warp=${WARP}"
