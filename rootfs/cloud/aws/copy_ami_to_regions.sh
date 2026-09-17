#!/bin/bash

# Copies an AMI to one or more additional regions within the same AWS partition, replacing any previous AMI for this repository/version in each destination and replicating the source AMI's tags.

if (( $# < 5 )); then
    echo "Usage copy_ami_to_regions.sh source_image_id ami_name repository([release,continuous,beta]) version([1.y,2.y,...]) dest_region [dest_region...]"
    exit 1;
fi

# Addressed by id rather than name: 'aws ec2 import-image' does not take a name, so the imported AMI carries only a generated one.
SOURCE_IMAGE_ID="$1"
AMI_NAME="$2"
REPO="$3"
REPO_VERSION="$4"
shift 4

set -u -e

SCRIPT_PATH=$(dirname "$0")
SOURCE_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

COPY_TIMEOUT_SECONDS="${COPY_TIMEOUT_SECONDS:-3600}"
COPY_POLL_SECONDS=30

# Replicated onto each copy so that tag-based AMI lookups (create_vpc.sh, create-virtualfleet.yml) resolve identically in every region. aws: tags are reserved and cannot be set.
source_tags=$(aws ec2 describe-images --region "${SOURCE_REGION}" --image-ids "${SOURCE_IMAGE_ID}" --query 'Images[0].Tags' --output json | jq -c '[(. // [])[] | select(.Key | startswith("aws:") | not)]')

for dest_region in "$@"; do
    echo ">>>>>> Copying ${SOURCE_IMAGE_ID} (${AMI_NAME}) from ${SOURCE_REGION} to ${dest_region}"

    # Delete first: AMI names are unique per region, so this also frees the name when a commit is rebuilt.
    ${SCRIPT_PATH}/delete_ami.sh "${REPO}" "${REPO_VERSION}" "--region ${dest_region}"

    dest_image_id=$(aws ec2 copy-image \
                        --region "${dest_region}" \
                        --source-region "${SOURCE_REGION}" \
                        --source-image-id "${SOURCE_IMAGE_ID}" \
                        --name "${AMI_NAME}" \
                        --description "JaiaBot ${REPO} ${REPO_VERSION}" \
                        --query 'ImageId' --output text)

    echo ">>>>>> Copy started as ${dest_image_id}, waiting for it to become available"

    waited=0
    while true; do
        state=$(aws ec2 describe-images --region "${dest_region}" --image-ids "${dest_image_id}" --query 'Images[0].State' --output text)

        [[ "${state}" == "available" ]] && break

        if [[ "${state}" != "pending" ]]; then
            echo "AMI ${dest_image_id} in ${dest_region} entered unexpected state: ${state}"
            aws ec2 describe-images --region "${dest_region}" --image-ids "${dest_image_id}"
            exit 1
        fi

        if (( waited >= COPY_TIMEOUT_SECONDS )); then
            echo "Timed out after ${waited}s waiting for ${dest_image_id} in ${dest_region} to become available"
            exit 1
        fi

        sleep ${COPY_POLL_SECONDS}
        waited=$(( waited + COPY_POLL_SECONDS ))
    done

    snapshot_ids=$(aws ec2 describe-images --region "${dest_region}" --image-ids "${dest_image_id}" --query 'Images[*].BlockDeviceMappings[*].Ebs.SnapshotId' --output text)

    aws ec2 create-tags --region "${dest_region}" --resources ${dest_image_id} ${snapshot_ids} --tags "${source_tags}"

    echo ">>>>>> Copied to ${dest_region} as ${dest_image_id}"
done
