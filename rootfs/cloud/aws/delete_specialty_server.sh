#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <server_type: iridium|vpn>"
    exit 1
fi

set -e -u

REGION=us-west-2
export AWS_DEFAULT_REGION=$REGION

SERVER_TYPE="$1"

echo "⚠️  WARNING: This script will permanently delete all AWS resources tagged as 'jaia_server_type=${SERVER_TYPE}'."
echo "This includes:"
echo "  - Terminating all EC2 instances"
echo "  - Disassociating (but NOT releasing) Elastic IP"
echo "  - Removal of security group"
echo "This action is irreversible!"

# Require user confirmation
read -p "To continue, re-type the jaia_server_type (${SERVER_TYPE}): " CONFIRM_SERVER_TYPE
if [ "$CONFIRM_SERVER_TYPE" != "$SERVER_TYPE" ]; then
    echo "❌ Server type mismatch. Aborting."
    exit 1
fi

echo "✅ Server type confirmed. Proceeding with cleanup of jaia_server_type=${SERVER_TYPE}..."

TAG_FILTER="Name=tag:jaia_server_type,Values=${SERVER_TYPE}"

echo "Finding resources with jaia_server_type=${SERVER_TYPE}..."

# Get EC2 instance IDs
INSTANCE_IDS=$(aws ec2 describe-instances --filters "$TAG_FILTER" --query "Reservations[].Instances[].InstanceId" --output text)

if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
    echo "Found instances: $INSTANCE_IDS"
    
    # Get and disassociate Elastic IPs
    ALLOC_IDS=$(aws ec2 describe-addresses --filters "$TAG_FILTER" --query "Addresses[].AllocationId" --output text)
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
SG_IDS=$(aws ec2 describe-security-groups --filters "$TAG_FILTER" --query "SecurityGroups[?GroupName!='default'].GroupId" --output text)
echo "Found SecurityGroups: $SG_IDS"
if [ -n "$SG_IDS" ] && [ "$SG_IDS" != "None" ]; then
    for SG_ID in $SG_IDS; do
        aws ec2 delete-security-group --group-id "$SG_ID"
    done
fi

echo "Cleanup completed for jaia_server_type=${SERVER_TYPE}"
