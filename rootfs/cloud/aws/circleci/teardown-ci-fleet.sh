#!/bin/bash

# Deletes this run's CloudHub and its bucket.
#
# Reads JAIA_CI_CUSTOMER and AWS_DEFAULT_REGION from the environment.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>  Fleet ID (default: \$JAIA_CI_FLEET, else 9)
  --keep       Leave the fleet up for the reaper instead of deleting it
EOF
    exit 1
}

set -u -e

FLEET="${JAIA_CI_FLEET:-9}"
KEEP=false

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --keep) KEEP=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

if $KEEP; then
    echo "leaving fleet ${FLEET} up for the reaper"
    exit 0
fi

script_dir=$(dirname "$(realpath "$0")")
repo_root=$(realpath "${script_dir}/../../../..")

# only this run's fleet: a concurrent trial reuses the same fleet id, and this runs even
# when create never got there
jaia admin fleet delete_cloudhub --region "${AWS_DEFAULT_REGION}" \
    --aws-profile OIDC-User --jaiabot-dir "${repo_root}" --yes \
    --customer "${JAIA_CI_CUSTOMER}" "${FLEET}"

"${script_dir}/delete-ci-bucket.sh" "${FLEET}"
