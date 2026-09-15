#!/bin/bash

# Deletes the AWS resources created by create_vpc.sh for one fleet.

usage() {
    cat <<EOF
Usage: $0 [options] <fleet ID>

  --yes                 Do not ask for confirmation (for unattended use)
  --keep-iam            Leave the CloudHub's IAM role and instance profile in place
  --customer <name>     Only delete this fleet if it carries this jaia_customer tag.
                        A fleet ID is reused, so an unattended teardown that names the
                        fleet alone will happily delete whatever is using it now.

The CloudHub's data bucket is never deleted: its logs outlive the fleet that wrote
them. Remove one deliberately with 'aws s3 rb --force' when that is really wanted.
EOF
    exit 1
}

set -u

ASSUME_YES=false
KEEP_IAM=false
CUSTOMER=""
FLEET_TAG_VALUE=""

while (( $# > 0 )); do
    case "$1" in
        --yes) ASSUME_YES=true; shift ;;
        --keep-iam) KEEP_IAM=true; shift ;;
        --customer) CUSTOMER="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1"; usage ;;
        *) [[ -z "$FLEET_TAG_VALUE" ]] || usage; FLEET_TAG_VALUE="$1"; shift ;;
    esac
done

[[ -n "$FLEET_TAG_VALUE" ]] || usage

# Partial creates leave some resources and not others, so a step that finds nothing to
# do must not stop the ones after it; failures are collected and reported at the end
FAILED=()

# Absence is the expected outcome after a partial create; anything else (a denial,
# most likely) is a real failure and must not read as a clean teardown
function exists() {
    # $1: resource description, ${@:2}: a command that fails with NoSuchEntity/404 when absent
    local what=$1 err
    if err=$("${@:2}" 2>&1 >/dev/null); then
        return 0
    fi
    if [[ "$err" == *NoSuchEntity* || "$err" == *"Not Found"* || "$err" == *404* ]]; then
        echo "No ${what} found."
        return 1
    fi
    echo "⚠️  Could not check ${what}: ${err}"
    FAILED+=("check ${what}")
    return 1
}

function attempt() {
    # $1: what is being done, ${@:2}: the command
    local what=$1
    if ! "${@:2}"; then
        echo "⚠️  Failed to ${what}"
        FAILED+=("$what")
        return 1
    fi
}

echo -e "⚠️  WARNING: This script will permanently delete all AWS resources tagged as 'jaia_fleet=$FLEET_TAG_VALUE' in region \033[1m$AWS_DEFAULT_REGION.\033[0m"
echo "This includes:"
echo "  - Terminating all EC2 instances"
echo "  - Disassociating and releasing Elastic IPs"
echo "  - Deleting VPC and all associated resources (subnets, route tables, security groups, internet gateways)"
if [ "$KEEP_IAM" = "false" ]; then
    echo "  - Deleting the CloudHub IAM role and instance profile for fleet $FLEET_TAG_VALUE"
fi
echo "This action is irreversible!"

if [ "$ASSUME_YES" = "false" ]; then
    read -p "To continue, re-enter the fleet number: " CONFIRM_FLEET
    if [ "$CONFIRM_FLEET" != "$FLEET_TAG_VALUE" ]; then
        echo "❌ Fleet number mismatch. Aborting."
        exit 1
    fi
fi

if [ -n "$CUSTOMER" ]; then
    owners=$( { aws ec2 describe-vpcs --filters "Name=tag:jaia_fleet,Values=$FLEET_TAG_VALUE" \
                    --query "Vpcs[].Tags[?Key=='jaia_customer'].Value" --output text
                aws ec2 describe-instances --filters "Name=tag:jaia_fleet,Values=$FLEET_TAG_VALUE" \
                    "Name=instance-state-name,Values=pending,running,stopping,stopped" \
                    --query "Reservations[].Instances[].Tags[?Key=='jaia_customer'].Value" --output text
              } | tr '\t' '\n' | sort -u | grep -v '^$' || true)
    for owner in $owners; do
        if [ "$owner" != "$CUSTOMER" ]; then
            echo "❌ Fleet $FLEET_TAG_VALUE belongs to $owner, not $CUSTOMER. Refusing to delete it." >&2
            exit 1
        fi
    done
fi

echo "✅ Proceeding with cleanup of jaia_fleet=$FLEET_TAG_VALUE..."

TAG_FILTER="Name=tag:jaia_fleet,Values=$FLEET_TAG_VALUE"

echo "Finding resources with jaia_fleet=$FLEET_TAG_VALUE..."

# Get EC2 instance IDs
INSTANCE_IDS=$(aws ec2 describe-instances --filters "$TAG_FILTER" "Name=instance-state-name,Values=pending,running,stopping,stopped" --query "Reservations[].Instances[].InstanceId" --output text)

if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
    echo "Found instances: $INSTANCE_IDS"

    # Get and disassociate Elastic IPs
    ALLOC_IDS=$(aws ec2 describe-addresses --filters "$TAG_FILTER" --query "Addresses[].AllocationId" --output text)
    if [ -n "$ALLOC_IDS" ] && [ "$ALLOC_IDS" != "None" ]; then
        echo "Disassociating and releasing Elastic IPs: $ALLOC_IDS"

        for ALLOC_ID in $ALLOC_IDS; do
            ASSOC_ID=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query "Addresses[].AssociationId" --output text)
            if [ -n "$ASSOC_ID" ] && [ "$ASSOC_ID" != "None" ]; then
                attempt "disassociate Elastic IP $ALLOC_ID" aws ec2 disassociate-address --association-id "$ASSOC_ID"
            fi
            attempt "release Elastic IP $ALLOC_ID" aws ec2 release-address --allocation-id "$ALLOC_ID"
        done
    fi

    # Terminate instances
    echo "Terminating instances: $INSTANCE_IDS"
    attempt "terminate instances" aws ec2 terminate-instances --no-cli-pager --instance-ids $INSTANCE_IDS

    # Wait for termination: the ENIs they hold block the subnets and security groups below
    echo "Waiting for instances to terminate..."
    attempt "wait for instances to terminate" aws ec2 wait instance-terminated --instance-ids $INSTANCE_IDS
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
            attempt "detach internet gateway $IGW_ID" aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" \
                && attempt "delete internet gateway $IGW_ID" aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID"
        done
    fi

    # Delete subnets
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[].SubnetId" --output text)
    echo "Found Subnets: $SUBNET_IDS"
    if [ -n "$SUBNET_IDS" ] && [ "$SUBNET_IDS" != "None" ]; then
        for SUBNET_ID in $SUBNET_IDS; do
            attempt "delete subnet $SUBNET_ID" aws ec2 delete-subnet --subnet-id "$SUBNET_ID"
        done
    fi

    # Delete route tables (excluding the main route table)
    RTB_IDS=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --query "RouteTables[?Associations[?Main==false]].RouteTableId" --output text)
    echo "Found RouteTables: $RTB_IDS"
    if [ -n "$RTB_IDS" ] && [ "$RTB_IDS" != "None" ]; then
        for RTB_ID in $RTB_IDS; do
            attempt "delete route table $RTB_ID" aws ec2 delete-route-table --route-table-id "$RTB_ID"
        done
    fi

    # Delete security groups (excluding default)
    SG_IDS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[?GroupName!='default'].GroupId" --output text)
    echo "Found SecurityGroups: $SG_IDS"
    if [ -n "$SG_IDS" ] && [ "$SG_IDS" != "None" ]; then
        for SG_ID in $SG_IDS; do
            attempt "delete security group $SG_ID" aws ec2 delete-security-group --group-id "$SG_ID"
        done
    fi

    # Finally, delete the VPC
    echo "Deleting VPC $VPC_ID..."
    attempt "delete VPC $VPC_ID" aws ec2 delete-vpc --vpc-id "$VPC_ID"
else
    echo "No VPC found."
fi

if [ "$KEEP_IAM" = "false" ]; then
    role_name="JaiaCloudHubFleet${FLEET_TAG_VALUE}__Role"
    policy_name="JaiaCloudHubFleet${FLEET_TAG_VALUE}__Policy"
    instance_profile_name="JaiaCloudHubFleet${FLEET_TAG_VALUE}__InstanceProfile"

    if exists "instance profile $instance_profile_name" aws iam get-instance-profile --instance-profile-name "$instance_profile_name"; then
        echo "Deleting instance profile $instance_profile_name..."
        aws iam remove-role-from-instance-profile --instance-profile-name "$instance_profile_name" --role-name "$role_name" > /dev/null 2>&1
        attempt "delete instance profile $instance_profile_name" aws iam delete-instance-profile --instance-profile-name "$instance_profile_name"
    fi

    if exists "role $role_name" aws iam get-role --role-name "$role_name"; then
        echo "Deleting role $role_name..."
        aws iam delete-role-policy --role-name "$role_name" --policy-name "$policy_name" > /dev/null 2>&1
        attempt "delete role $role_name" aws iam delete-role --role-name "$role_name"
    fi
fi

if (( ${#FAILED[@]} > 0 )); then
    echo "❌ Cleanup of jaia_fleet=$FLEET_TAG_VALUE did not complete. Check these manually:" >&2
    printf '\t%s\n' "${FAILED[@]}" >&2
    exit 1
fi

echo "Cleanup completed for jaia_fleet=$FLEET_TAG_VALUE."
