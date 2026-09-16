#!/bin/bash

# Deletes CI fleets left behind by builds that were killed before they could tear down.

usage() {
    cat <<EOF
Usage: $0 [options]

  --customer-prefix <s>  Only reap fleets whose jaia_customer tag starts with this
                         (default: jaia-ci-)
  --max-age-hours <n>    Leave fleets younger than this alone (default: 4)
  --dry-run              Report what would be deleted without deleting it
EOF
    exit 1
}

set -u

SCRIPT_PATH=$(dirname "$0")
CUSTOMER_PREFIX="jaia-ci-"
MAX_AGE_HOURS=4
DRY_RUN=false

while (( $# > 0 )); do
    case "$1" in
        --customer-prefix) CUSTOMER_PREFIX="${2:-}"; shift 2 ;;
        --max-age-hours) MAX_AGE_HOURS="${2:-}"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

# A prefix that matched everything would reap customer fleets, so refuse an empty one
if [[ -z "$CUSTOMER_PREFIX" || "$CUSTOMER_PREFIX" == "*" ]]; then
    echo "ERROR: --customer-prefix must be specific enough not to match customer fleets" >&2
    exit 1
fi

MAX_AGE_SECONDS=$(( MAX_AGE_HOURS * 3600 ))
NOW=$(date -u +%s)

echo ">>>>>> Reaping fleets tagged jaia_customer=${CUSTOMER_PREFIX}* older than ${MAX_AGE_HOURS}h in ${AWS_DEFAULT_REGION}"

# Only create_vpc.sh stamps a creation time, so a VirtualFleet instance carries none.
# Resources are therefore grouped per fleet and dated by the best any of them knows,
# rather than each being judged on its own.
fleets=$(
    {
        aws ec2 describe-vpcs --filters "Name=tag:jaia_customer,Values=${CUSTOMER_PREFIX}*" \
            --query 'Vpcs[].Tags' --output json
        aws ec2 describe-instances --filters "Name=tag:jaia_customer,Values=${CUSTOMER_PREFIX}*" \
            "Name=instance-state-name,Values=pending,running,stopping,stopped" \
            --query 'Reservations[].Instances[].Tags' --output json
    } | jq -s -r '
        add // [] | map(
            (map(select(.Key == "jaia_fleet")) | .[0].Value // empty) as $fleet |
            (map(select(.Key == "jaia_created_unixtime")) | .[0].Value // "0") as $created |
            (map(select(.Key == "jaia_customer")) | .[0].Value // "") as $customer |
            select($fleet != null) |
            {fleet: $fleet, created: ($created | tonumber), customer: $customer}
        ) | group_by(.fleet) | map({
            fleet: .[0].fleet,
            created: (map(.created) | max),
            customer: (map(select(.customer != "")) | .[0].customer // "")
        }) | .[] | "\(.fleet) \(.created) \(.customer)"'
)

# EC2 dates its own instances, so a fleet whose tag is missing can still be aged
function oldest_launch_epoch() {
    local launched
    launched=$(aws ec2 describe-instances --filters "Name=tag:jaia_fleet,Values=$1" \
                   "Name=instance-state-name,Values=pending,running,stopping,stopped" \
                   --query 'min(Reservations[].Instances[].LaunchTime)' --output text 2>/dev/null || true)
    if [[ -z "$launched" || "$launched" == "None" ]]; then
        echo 0
    else
        date -d "$launched" +%s 2>/dev/null || echo 0
    fi
}

if [[ -z "$fleets" ]]; then
    echo ">>>>>> Nothing tagged jaia_customer=${CUSTOMER_PREFIX}* found"
    exit 0
fi

reaped=0
failed=0
skipped=0
while read -r fleet created customer; do
    [[ -n "$fleet" ]] || continue

    (( created > 0 )) || created=$(oldest_launch_epoch "$fleet")

    # Not knowing how old a fleet is has to mean leaving it alone: guessing the other
    # way deletes whatever is using it right now
    if (( created == 0 )); then
        echo "⚠️  Fleet ${fleet} has no creation time and no instance to date it by; leaving it alone" >&2
        skipped=$(( skipped + 1 ))
        continue
    fi

    age=$(( NOW - created ))
    if (( age < MAX_AGE_SECONDS )); then
        echo ">>>>>> Fleet ${fleet} is $(( age / 60 ))m old, leaving it alone"
        continue
    fi
    echo ">>>>>> Fleet ${fleet} is $(( age / 3600 ))h old, reaping"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo ">>>>>> (dry run) would delete fleet ${fleet} and its bucket"
        continue
    fi

    if "${SCRIPT_PATH}/delete_vpc.sh" --yes --customer "$customer" "$fleet" \
       && "${SCRIPT_PATH}/circleci/delete-ci-bucket.sh" --customer-prefix "$CUSTOMER_PREFIX" "$fleet"; then
        reaped=$(( reaped + 1 ))
    else
        echo "⚠️  Reaping fleet ${fleet} did not complete" >&2
        failed=$(( failed + 1 ))
    fi
done <<< "$fleets"

echo ">>>>>> Reaped ${reaped} fleet(s), ${failed} incomplete, ${skipped} left alone for want of an age"
(( failed == 0 ))
