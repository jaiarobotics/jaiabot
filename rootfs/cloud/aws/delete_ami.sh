#!/bin/bash

# Deregisters all AMIs and deletes associated snapshots for a given repository. This is used before uploading a new AMI for this repository, to ensure we don't have more than one at a time

if (( $# < 1 )); then
    echo "Usage delete_ami.sh repository([release,continuous,beta]) version([1.y,2.y,...]) aws_cli_extra_args"
    exit 1;
fi

REPO="$1"
REPO_VERSION="$2"
EXTRA_AWS_CLI_ARGS="$3"


set -u -e
set -x

# List AMIs with the specific tag and value
ami_ids=$(aws ec2 describe-images --filters "Name=tag:jaiabot-rootfs-gen_repository,Values=${REPO}" "Name=tag:jaiabot-rootfs-gen_repository_version,Values=${REPO_VERSION}" --query "Images[*].ImageId" --output text ${EXTRA_AWS_CLI_ARGS})

# Loop over each AMI
for ami_id in $ami_ids; do
    # Get the associated snapshot IDs
    snapshot_ids=$(aws ec2 describe-images --image-ids $ami_id --query "Images[*].BlockDeviceMappings[*].Ebs.SnapshotId" --output text  ${EXTRA_AWS_CLI_ARGS})

    # Deregister the AMI
    aws ec2 deregister-image --image-id $ami_id  ${EXTRA_AWS_CLI_ARGS}

    # Delete each associated snapshot
    for snapshot_id in $snapshot_ids; do
        aws ec2 delete-snapshot --snapshot-id $snapshot_id ${EXTRA_AWS_CLI_ARGS}
    done
done
