#!/bin/bash

# Writes a throwaway fleet config and brings up the CloudHub a sea trial runs from.
#
# Reads JAIA_CI_CUSTOMER, JAIA_CI_REPO and AWS_DEFAULT_REGION from the environment.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>          Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --bots <n>           Number of bots (default: 2)
  --warp <n>           Simulator warp (default: 5)
  --instance-type <s>  CloudHub instance type (default: t3a.small)
  --output-dir <s>     Where the fleet config and CloudHub json land (default: /tmp/sea-trial)
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"
BOTS=2
WARP=5
INSTANCE_TYPE=t3a.small
OUTPUT_DIR=/tmp/sea-trial

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --bots) BOTS="${2:-}"; shift 2 ;;
        --warp) WARP="${2:-}"; shift 2 ;;
        --instance-type) INSTANCE_TYPE="${2:-}"; shift 2 ;;
        --output-dir) OUTPUT_DIR="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

script_dir=$(dirname "$(realpath "$0")")
repo_root=$(realpath "${script_dir}/../../../..")

mkdir -p "${OUTPUT_DIR}"

"${script_dir}/make-ci-fleet-config.sh" \
    --fleet "${FLEET}" \
    --bots "${BOTS}" \
    --warp "${WARP}" \
    "${OUTPUT_DIR}/fleet.cfg"

jaia admin fleet create_cloudhub "${OUTPUT_DIR}/fleet.cfg" "${JAIA_CI_CUSTOMER}" \
    --region "${AWS_DEFAULT_REGION}" \
    --repo "${JAIA_CI_REPO}" \
    --permissions-boundary JaiaCloudHubBoundary \
    --instance-type "${INSTANCE_TYPE}" \
    --virtualfleet-instance-type "${INSTANCE_TYPE}" \
    --output-json "${OUTPUT_DIR}/cloudhub.json" \
    --jaiabot-dir "${repo_root}" \
    --aws-profile OIDC-User
