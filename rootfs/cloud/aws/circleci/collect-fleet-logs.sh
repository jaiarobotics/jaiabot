#!/bin/bash

# Dumps each VirtualFleet node's journal, from the CloudHub, which is the only machine
# that reaches them. The bots' own debug logs are text, and jaiabot-predataoffload.sh
# excludes *.txt* from the offload, so nothing here arrives by any other route.

usage() {
    cat <<USAGE
Usage: $0 [options] <output directory>

  --fleet <n>   Fleet ID (default: \$jaia_fleet_index, else 0)
  --bots <n>    Number of bots to collect from (default: 2)
  --hubs <n>    Number of hubs to collect from (default: 1)
  --lines <n>   Journal lines per node (default: 5000)
USAGE
    exit 1
}

set -u

FLEET="${jaia_fleet_index:-0}"
BOTS=2
HUBS=1
LINES=5000
OUT=""

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --hubs) HUBS="${2:-}"; shift 2 ;;
        --lines) LINES="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage ;;
        *) [[ -z "$OUT" ]] || usage; OUT="$1"; shift ;;
    esac
done

[[ -n "$OUT" ]] || usage
mkdir -p "$OUT"

# The units that decide a bot's health: the coroner judges whether every app is alive,
# jaiabot_health turns that into the report the mission manager self-tests against
UNITS=(jaiabot_health jaiabot_mission_manager goby_coroner jaiabot_fusion gobyd)
unit_args=()
for unit in "${UNITS[@]}"; do unit_args+=(-u "${unit}"); done

collect() {
    local kind=$1 id=$2 addr name
    name="${kind}${id}"
    addr=$(jaia_ip --query_type addr --node_type "$kind" --ip_net vfleet_vpn \
                   --fleet_id "$FLEET" --node_id "$id" 2>/dev/null)
    if [[ -z "$addr" ]]; then
        echo "⚠️  Could not resolve ${name} on fleet ${FLEET}" >&2
        return
    fi
    echo ">>>>>> Collecting ${name} (${addr})"
    if ! ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "jaia@${addr}" \
         "journalctl ${unit_args[*]} --no-pager -n ${LINES}" > "${OUT}/${name}-journal.txt" 2>&1
    then
        echo "⚠️  ${name} journal incomplete; see ${OUT}/${name}-journal.txt" >&2
    fi
}

for (( id = 1; id <= HUBS; id++ )); do collect hub "$id"; done
for (( id = 1; id <= BOTS; id++ )); do collect bot "$id"; done

echo ">>>>>> Wrote $(ls -1 "$OUT" | wc -l) journal(s) to ${OUT}"
