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

# VPCs carry the fleet's identity and creation time; instances are checked too so that a
# fleet whose VPC deletion already succeeded does not strand its instances
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
            select($fleet != null) | "\($fleet) \($created) \($customer)"
        ) | unique | .[]'
)

if [[ -z "$fleets" ]]; then
    echo ">>>>>> Nothing tagged jaia_customer=${CUSTOMER_PREFIX}* found"
    exit 0
fi

reaped=0
failed=0
while read -r fleet created customer; do
    [[ -n "$fleet" ]] || continue

    # An untagged creation time means the fleet predates the tag; treat it as old enough
    # to reap rather than leaving it to accumulate forever
    if (( created > 0 )); then
        age=$(( NOW - created ))
        if (( age < MAX_AGE_SECONDS )); then
            echo ">>>>>> Fleet ${fleet} is $(( age / 60 ))m old, leaving it alone"
            continue
        fi
        echo ">>>>>> Fleet ${fleet} is $(( age / 3600 ))h old, reaping"
    else
        echo ">>>>>> Fleet ${fleet} carries no creation time, reaping"
    fi

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

echo ">>>>>> Reaped ${reaped} fleet(s), ${failed} incomplete"
(( failed == 0 ))
