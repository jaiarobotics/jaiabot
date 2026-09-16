#!/bin/bash

# Waits for a fleet ID to be free, so concurrent trials queue instead of colliding.
#
# create_vpc.sh refuses to build a second VPC for a fleet that already has one, which is
# what stops two runs sharing a fleet. A CI fleet is a single reserved ID, so without
# this every overlapping run fails immediately rather than waiting its turn.

usage() {
    cat <<EOF
Usage: $0 [options] <fleet ID>

  --timeout-minutes <n>  Give up after this long (default: 30)
  --poll-seconds <n>     Seconds between checks (default: 30)
EOF
    exit 1
}

set -u -e

TIMEOUT_MINUTES=30
POLL_SECONDS=30
FLEET=""

while (( $# > 0 )); do
    case "$1" in
        --timeout-minutes) TIMEOUT_MINUTES="${2:-}"; shift 2 ;;
        --poll-seconds) POLL_SECONDS="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage ;;
        *) [[ -z "$FLEET" ]] || usage; FLEET="$1"; shift ;;
    esac
done

[[ -n "$FLEET" ]] || usage

function fleet_holder() {
    { aws ec2 describe-vpcs --filters "Name=tag:jaia_fleet,Values=${FLEET}" \
          --query "Vpcs[].Tags[?Key=='jaia_customer'].Value" --output text
      aws ec2 describe-instances --filters "Name=tag:jaia_fleet,Values=${FLEET}" \
          "Name=instance-state-name,Values=pending,running,stopping,stopped" \
          --query "Reservations[].Instances[].Tags[?Key=='jaia_customer'].Value" --output text
    } | tr '\t' '\n' | sort -u | grep -v '^$' | head -1 || true
}

deadline=$(( SECONDS + TIMEOUT_MINUTES * 60 ))
while true; do
    holder=$(fleet_holder)
    if [[ -z "$holder" ]]; then
        break
    fi
    if (( SECONDS >= deadline )); then
        echo "❌ Fleet ${FLEET} still held by ${holder} after ${TIMEOUT_MINUTES} minutes" >&2
        exit 1
    fi
    echo ">>>>>> Fleet ${FLEET} is held by ${holder}; waiting ($(( (deadline - SECONDS) / 60 ))m left)"
    sleep "${POLL_SECONDS}"
done

# Two runs released at once would both see it free. create_vpc.sh claims the fleet in the
# same call that creates the VPC, so the window is now a describe catching up rather than
# a whole create, and a short random pause is enough to stagger them out of it.
sleep $(( RANDOM % 15 ))

holder=$(fleet_holder)
if [[ -n "$holder" ]]; then
    echo "❌ Fleet ${FLEET} was taken by ${holder} while waiting to start" >&2
    exit 1
fi

echo ">>>>>> Fleet ${FLEET} is free"
