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

node_addr() {
    local addr
    addr=$(jaia_ip --query_type addr --node_type "$1" --ip_net vfleet_vpn \
                   --fleet_id "$FLEET" --node_id "$2" 2>/dev/null)
    if [[ -z "$addr" ]]; then
        echo "⚠️  Could not resolve ${1}${2} on fleet ${FLEET}" >&2
        return 1
    fi
    echo "$addr"
}

collect() {
    local kind=$1 id=$2 addr name
    name="${kind}${id}"
    addr=$(node_addr "$kind" "$id") || return
    echo ">>>>>> Collecting ${name} (${addr})"
    if ! ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "jaia@${addr}" \
         "journalctl ${unit_args[*]} --no-pager -n ${LINES}" > "${OUT}/${name}-journal.txt" 2>&1
    then
        echo "⚠️  ${name} journal incomplete; see ${OUT}/${name}-journal.txt" >&2
    fi
}

# What the self test actually judged. VehicleHealth is published on every health report
# and logged, so it survives a fault that has cleared before anything polls BotStatus.
# The bot keeps its own log until the offload moves it to the hub, so look in both.
health_report() {
    local id=$1 addr name=bot$1
    addr=$(node_addr bot "$id") || return
    echo ">>>>>> Converting ${name} health reports"
    ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "jaia@${addr}" \
        "goby log convert --input_file /var/log/jaiabot/bot/${id} \
             --output_file /tmp/${name}-health.txt --format DEBUG_TEXT \
             --type_regex '.*VehicleHealth' \
             --load_shared_library libjaiabot_messages.so.1 > /dev/null 2>&1; \
         cat /tmp/${name}-health.txt 2>/dev/null" > "${OUT}/${name}-health.txt" 2>/dev/null

    # empty means the offload already moved the log off the bot, so convert the hub's copy
    if [[ ! -s "${OUT}/${name}-health.txt" ]]; then
        local hub_addr
        hub_addr=$(node_addr hub 1) || return
        ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "jaia@${hub_addr}" \
            "for f in /var/log/jaiabot/bot_offload/${name}_fleet*_*.goby; do \
                 [ -e \"\$f\" ] || continue; \
                 goby log convert --input_file \"\$f\" --output_file /tmp/${name}-health.txt \
                     --format DEBUG_TEXT --type_regex '.*VehicleHealth' \
                     --load_shared_library libjaiabot_messages.so.1 > /dev/null 2>&1; \
                 cat /tmp/${name}-health.txt 2>/dev/null; \
             done" > "${OUT}/${name}-health.txt" 2>/dev/null
    fi
    [[ -s "${OUT}/${name}-health.txt" ]] \
        || echo "⚠️  No health reports recovered for ${name}" >&2
}

for (( id = 1; id <= HUBS; id++ )); do collect hub "$id"; done
for (( id = 1; id <= BOTS; id++ )); do collect bot "$id"; health_report "$id"; done

echo ">>>>>> Wrote $(ls -1 "$OUT" | wc -l) file(s) to ${OUT}"
