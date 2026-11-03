#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <server_type: iridium|vpn|packages|...>"
    echo "   or: $0 <server.conf>, to delete only the server that conf names, in its region"
    exit 1
fi

if [ -f "$1" ]; then
    # As create_specialty_server.sh reads it
    SCRIPT_PATH=$(dirname "$0")
    REGION=us-west-2
    SERVER_NAME=
    set -a; source "$1"; set +a
    SERVER_NAME=${SERVER_NAME:-${SERVER_TYPE}.jaia.tech}
    export AWS_DEFAULT_REGION=$REGION
    TARGET=$SERVER_NAME
    INSTANCE_FILTERS=("Name=tag:jaia_server_type,Values=${SERVER_TYPE}" "Name=tag:Name,Values=${SERVER_NAME}")
    SG_FILTERS=("Name=tag:jaia_server_type,Values=${SERVER_TYPE}" "Name=tag:Name,Values=${SERVER_NAME} Security Group")
else
    if [ -z "$AWS_DEFAULT_REGION" ]; then
        REGION=us-west-2
        export AWS_DEFAULT_REGION=$REGION
    fi

    # for ease of switching between cloudhub creation and speciality server creation
    if [ "$AWS_DEFAULT_REGION" = "us-east-1" ]; then
        REGION=us-west-2
        export AWS_DEFAULT_REGION=$REGION
    fi
    SERVER_TYPE="$1"
    TARGET=$SERVER_TYPE
    INSTANCE_FILTERS=("Name=tag:jaia_server_type,Values=${SERVER_TYPE}")
    SG_FILTERS=("${INSTANCE_FILTERS[@]}")
fi

set -e -u

echo -e "⚠️  WARNING: This script will permanently delete all AWS resources tagged as 'jaia_server_type=${SERVER_TYPE}'$([ "$TARGET" != "$SERVER_TYPE" ] && echo " and 'Name=${TARGET}'") in region \033[1m$AWS_DEFAULT_REGION.\033[0m"
echo "This includes:"
echo "  - Terminating all EC2 instances"
echo "  - Disassociating (but NOT releasing) Elastic IP"
echo "  - Removal of security group"
echo "This action is irreversible!"

# Require user confirmation
read -p "To continue, re-type ${TARGET}: " CONFIRM_TARGET
if [ "$CONFIRM_TARGET" != "$TARGET" ]; then
    echo "❌ Mismatch. Aborting."
    exit 1
fi

echo "✅ Confirmed. Proceeding with cleanup of ${TARGET}..."

# Get EC2 instance IDs
INSTANCE_IDS=$(aws ec2 describe-instances --filters "${INSTANCE_FILTERS[@]}" "Name=instance-state-name,Values=pending,running,stopping,stopped" --query "Reservations[].Instances[].InstanceId" --output text)

if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
    echo "Found instances: $INSTANCE_IDS"
    
    # Get and disassociate Elastic IPs
    ALLOC_IDS=$(aws ec2 describe-addresses --filters "Name=instance-id,Values=$(echo $INSTANCE_IDS | tr " " ,)" --query "Addresses[].AllocationId" --output text)
    if [ -n "$ALLOC_IDS" ] && [ "$ALLOC_IDS" != "None" ]; then
        echo "Disassociating (but NOT releasing) Elastic IPs: $ALLOC_IDS"

        for ALLOC_ID in $ALLOC_IDS; do
            ASSOC_ID=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query "Addresses[].AssociationId" --output text)
            if [ -n "$ASSOC_ID" ] && [ "$ASSOC_ID" != "None" ]; then
                aws ec2 disassociate-address --association-id "$ASSOC_ID"
            fi
        done
    fi
    
    # Terminate instances
    echo "Terminating instances: $INSTANCE_IDS"    
    aws ec2 terminate-instances --no-cli-pager --instance-ids $INSTANCE_IDS 

    # Wait for termination
    echo "Waiting for instances to terminate..."
    aws ec2 wait instance-terminated --instance-ids $INSTANCE_IDS
else
    echo "No instances found."
fi

# Delete security groups
SG_IDS=$(aws ec2 describe-security-groups --filters "${SG_FILTERS[@]}" --query "SecurityGroups[?GroupName!='default'].GroupId" --output text)
echo "Found SecurityGroups: $SG_IDS"
if [ -n "$SG_IDS" ] && [ "$SG_IDS" != "None" ]; then
    for SG_ID in $SG_IDS; do
        aws ec2 delete-security-group --group-id "$SG_ID"
    done
fi

echo "Cleanup completed for ${TARGET}"
