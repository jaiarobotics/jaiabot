#!/bin/bash

set -u -e

REGION=us-east-1
JAIA_AWS_ACCOUNT=120512385734
BASE_REPO=test
BASE_VERSION=1.y

UPGRADE_REPO=test
UPGRADE_VERSION=2.y

SCRIPT_PATH=$(dirname "$0")

UPGRADE_AMI_NAME=${1:-"TEST-packer-ami-jaia-${UPGRADE_REPO}-${UPGRADE_VERSION}"}
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

packer build -var "source_ami=$LATEST_AMI" -var "aws_region=$REGION" -var "jaia_upgrade_repo=${UPGRADE_REPO}" -var "jaia_upgrade_version=${UPGRADE_VERSION}" -var "ami_name=$UPGRADE_AMI_NAME" -var "iso_source=$JAIA_UPGRADE_ISO_SOURCE" -var "iso_local_dir=$JAIA_UPGRADE_ISO_LOCAL_DIR" packer-template.pkr.hcl
