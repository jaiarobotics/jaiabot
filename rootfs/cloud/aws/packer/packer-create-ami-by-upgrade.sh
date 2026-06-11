#!/bin/bash

# usage ./packer-create-ami-by-upgrade.sh <ami_name> <upgrade repo: release, beta, etc.>

set -u -e

REGION=${AWS_DEFAULT_REGION:-us-east-1}

if [ -z "${JAIA_AWS_ACCOUNT:-}" ]; then
    if [ "${REGION}" = "us-gov-east-1" ]; then
        JAIA_AWS_ACCOUNT=497433381399
    else
        JAIA_AWS_ACCOUNT=120512385734
    fi
fi

UPGRADE_REPO=${2}
BASE_REPO=release
BASE_VERSION=2.y
UPGRADE_VERSION=3.y

SCRIPT_PATH=$(dirname "$0")

UPGRADE_AMI_NAME=${1}
JAIA_UPGRADE_ISO_SOURCE=${JAIA_UPGRADE_ISO_SOURCE:-"s3"}
JAIA_UPGRADE_ISO_LOCAL_DIR=${JAIA_UPGRADE_ISO_LOCAL_DIR:-""}

function finish {
    ( # Run in a subshell to ignore errors
        set +e
        rm -f id_packer*
    )
}
trap finish EXIT

cd ${SCRIPT_PATH}

rm -f id_packer*
ssh-keygen -N "" -t ed25519 -f id_packer -C "packer"
sed "s|\(ssh_authorized_keys: \)\[.*\]|\1[\"$(cat id_packer.pub)\"]|" ec2_base/user-data.in > ec2_base/user-data

LATEST_AMI=$(aws ec2 describe-images \
                 --region $REGION \
                 --owners $JAIA_AWS_ACCOUNT \
                 --filters "Name=tag:jaiabot-rootfs-gen_repository,Values=${BASE_REPO}" "Name=tag:jaiabot-rootfs-gen_repository_version,Values=${BASE_VERSION}" \
                 --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
                 --output text)

if [ -z "${LATEST_AMI}" ] || [ "${LATEST_AMI}" = "None" ]; then
    echo "Could not find base AMI for repo ${BASE_REPO}, version ${BASE_VERSION}, region ${REGION}, account ${JAIA_AWS_ACCOUNT}" >&2
    exit 1
fi

packer build -on-error=ask  -var "source_ami=$LATEST_AMI" -var "aws_region=$REGION" -var "jaia_upgrade_repo=${UPGRADE_REPO}" -var "jaia_upgrade_version=${UPGRADE_VERSION}" -var "ami_name=$UPGRADE_AMI_NAME" -var "iso_source=$JAIA_UPGRADE_ISO_SOURCE" -var "iso_local_dir=$JAIA_UPGRADE_ISO_LOCAL_DIR" packer-template.pkr.hcl 
