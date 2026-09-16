#!/bin/bash

# Empties and deletes a CI fleet's CloudHub data bucket.
#
# Deleting a bucket is deliberately not something delete_vpc.sh will do: a fleet's logs
# normally outlive the fleet. A CI fleet's do not, so its teardown calls this instead.

usage() {
    cat <<EOF
Usage: $0 [--customer-prefix <s>] <fleet ID>

  --customer-prefix <s>  Refuse a bucket whose jaia_customer tag does not start with
                         this (default: jaia-ci-). Pass '' to skip the check when the
                         bucket carries no tags yet.
EOF
    exit 1
}

set -u -e

CUSTOMER_PREFIX="jaia-ci-"
FLEET=""

while (( $# > 0 )); do
    case "$1" in
        --customer-prefix) CUSTOMER_PREFIX="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage ;;
        *) [[ -z "$FLEET" ]] || usage; FLEET="$1"; shift ;;
    esac
done

[[ -n "$FLEET" ]] || usage
BUCKET="jaia--cloudhub-data--fleet${FLEET}"

if ! aws s3api head-bucket --bucket "$BUCKET" > /dev/null 2>&1; then
    echo ">>>>>> No bucket ${BUCKET} to delete"
    exit 0
fi

# A customer bucket reachable at this name would be someone's flight logs, so the tag has
# to say it belongs to CI before anything is emptied
if [[ -n "$CUSTOMER_PREFIX" ]]; then
    customer=$(aws s3api get-bucket-tagging --bucket "$BUCKET" \
                   --query "TagSet[?Key=='jaia_customer'].Value | [0]" --output text 2>/dev/null || echo "")
    if [[ "$customer" != "${CUSTOMER_PREFIX}"* ]]; then
        echo "ERROR: ${BUCKET} is tagged jaia_customer=${customer:-<none>}, which is not a CI fleet." >&2
        echo "       Refusing to delete it. Pass --customer-prefix '' to override." >&2
        exit 1
    fi
fi

echo ">>>>>> Emptying and deleting ${BUCKET}"
aws s3 rm "s3://${BUCKET}" --recursive --only-show-errors
aws s3api delete-bucket --bucket "$BUCKET"
echo ">>>>>> Deleted ${BUCKET}"
