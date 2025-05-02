#!/bin/bash

set -e -u

# Check for required argument
if [ -z "$1" ]; then
    echo "Usage: $0 <fleet ID>"
    exit 1
fi

FLEET_TAG_VALUE="$1"

echo "⚠️  WARNING: This script will permanently delete all AWS resources tagged as 'jaia_fleet=$FLEET_TAG_VALUE'."
echo "This includes:"
echo "  - Terminating all EC2 instances"
echo "  - Disassociating and releasing Elastic IPs"
echo "  - Deleting VPC and all associated resources (subnets, route tables, security groups, internet gateways)"
echo "This action is irreversible!"

# Require user confirmation
read -p "To continue, re-enter the fleet number: " CONFIRM_FLEET
if [ "$CONFIRM_FLEET" != "$FLEET_TAG_VALUE" ]; then
    echo "❌ Fleet number mismatch. Aborting."
    exit 1
fi

echo "✅ Fleet number confirmed. Proceeding with cleanup of jaia_fleet=$FLEET_TAG_VALUE..."


TAG_FILTER="Name=tag:jaia_fleet,Values=$FLEET_TAG_VALUE"

echo "Finding resources with jaia_fleet=$FLEET_TAG_VALUE..."

# Get EC2 instance IDs
INSTANCE_IDS=$(aws ec2 describe-instances --filters "$TAG_FILTER" --query "Reservations[].Instances[].InstanceId" --output text)

if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
    echo "Found instances: $INSTANCE_IDS"
    
    # Get and disassociate Elastic IPs
    ALLOC_IDS=$(aws ec2 describe-addresses --filters "$TAG_FILTER" --query "Addresses[].AllocationId" --output text)
    if [ -n "$ALLOC_IDS" ] && [ "$ALLOC_IDS" != "None" ]; then
        echo "Disassociating and releasing Elastic IPs: $ALLOC_IDS"
        

        for ALLOC_ID in $ALLOC_IDS; do
            ASSOC_ID=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query "Addresses[].AssociationId" --output text)
            if [ -n "$ASSOC_ID" ] && [ "$ASSOC_ID" != "None" ]; then
                aws ec2 disassociate-address --association-id "$ASSOC_ID"
            fi
            aws ec2 release-address --allocation-id "$ALLOC_ID"
        done
    fi
    
    # Terminate instances
    echo "Terminating instances: $INSTANCE_IDS"    
    aws ec2 terminate-instances --instance-ids $INSTANCE_IDS

    # Wait for termination
    echo "Waiting for instances to terminate..."
    aws ec2 wait instance-terminated --instance-ids $INSTANCE_IDS
else
    echo "No instances found."
fi

# Get VPC ID associated with the fleet
VPC_ID=$(aws ec2 describe-vpcs --filters "$TAG_FILTER" --query "Vpcs[].VpcId" --output text)

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
    echo "Found VPC: $VPC_ID"

    # Delete dependent resources before deleting the VPC
    echo "Deleting dependent resources in VPC $VPC_ID..."

    # Delete Internet Gateways
    IGW_IDS=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query "InternetGateways[].InternetGatewayId" --output text)    

    echo "Found InternetGateways: $IGW_IDS"
    if [ -n "$IGW_IDS" ] && [ "$IGW_IDS" != "None" ]; then
        for IGW_ID in $IGW_IDS; do
            aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID"
            aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID"
        done
    fi

    # Delete subnets
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[].SubnetId" --output text)
    echo "Found Subnets: $SUBNET_IDS"
    if [ -n "$SUBNET_IDS" ] && [ "$SUBNET_IDS" != "None" ]; then
        for SUBNET_ID in $SUBNET_IDS; do
            aws ec2 delete-subnet --subnet-id "$SUBNET_ID"
        done
    fi

    # Delete route tables (excluding the main route table)
    RTB_IDS=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --query "RouteTables[?Associations[?Main==false]].RouteTableId" --output text)
    echo "Found RouteTables: $RTB_IDS"
    if [ -n "$RTB_IDS" ] && [ "$RTB_IDS" != "None" ]; then
        for RTB_ID in $RTB_IDS; do
            aws ec2 delete-route-table --route-table-id "$RTB_ID"
        done
    fi

    # Delete security groups (excluding default)
    SG_IDS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[?GroupName!='default'].GroupId" --output text)
    echo "Found SecurityGroups: $SG_IDS"
    if [ -n "$SG_IDS" ] && [ "$SG_IDS" != "None" ]; then
        for SG_ID in $SG_IDS; do
            aws ec2 delete-security-group --group-id "$SG_ID"
        done
    fi

    # Finally, delete the VPC
    echo "Deleting VPC $VPC_ID..."
    aws ec2 delete-vpc --vpc-id "$VPC_ID"
else
    echo "No VPC found."
fi

echo "Cleanup completed for jaia_fleet=$FLEET_TAG_VALUE."
