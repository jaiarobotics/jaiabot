#!/bin/bash
set -u -e

SCRIPT_PATH=$(dirname "$0")
source ${SCRIPT_PATH}/includes/aws_run.sh

ROLLBACK_CMDS=()
ROLLBACK_ARMED=true
INTERRUPTED=""

# Interrupts are deferred so a resource being created is registered for rollback before exiting
function exit_if_interrupted() {
    [[ -z "$INTERRUPTED" ]] || exit $INTERRUPTED
}

# Register a command that undoes the resource just created; run in reverse order on failure
function on_rollback() {
    ROLLBACK_CMDS+=("$*")
    exit_if_interrupted
}

function on_exit() {
    local status=$?
    trap - ERR EXIT
    trap '' INT TERM
    set +e +u

    rm -rf "$TMPDIR"

    if [[ "$ROLLBACK_ARMED" != "true" || ${#ROLLBACK_CMDS[@]} -eq 0 ]]; then
        exit $status
    fi

    echo ">>>>>> CloudHub creation did not complete, rolling back created resources (Ctrl-C is ignored until done)" >&2
    local failed=()
    local i attempt ok
    for (( i=${#ROLLBACK_CMDS[@]}-1; i>=0; i-- )); do
        local cmd=${ROLLBACK_CMDS[$i]}
        echo ">>>>>> Rollback: $cmd" >&2
        ok=false
        # Retry to ride out DependencyViolation while terminated instances release their ENIs
        for attempt in 1 2 3 4 5; do
            if eval "$cmd" > /dev/null; then ok=true; break; fi
            (( attempt < 5 )) && sleep 10
        done
        [[ "$ok" == "true" ]] || failed+=("$cmd")
    done

    if (( ${#failed[@]} > 0 )); then
        echo ">>>>>> ROLLBACK INCOMPLETE. Clean up these resources manually:" >&2
        printf '\t%s\n' "${failed[@]}" >&2
    else
        echo ">>>>>> Rollback complete" >&2
    fi
    (( status == 0 )) && status=1
    exit $status
}
trap on_exit EXIT
trap 'INTERRUPTED=130' INT
trap 'INTERRUPTED=143' TERM

# Check if necessary parameters are provided
if (( "$#" != 1 )); then
    echo "Usage: $0 vpc.conf"
    exit 1
fi

set -a; source $1; set +a

# Optional settings, absent from configs written before they existed
OUTPUT_JSON=${OUTPUT_JSON:-}
CLOUDHUB_PERMISSIONS_BOUNDARY=${CLOUDHUB_PERMISSIONS_BOUNDARY:-}
WAIT_TIMEOUT_SECONDS=${WAIT_TIMEOUT_SECONDS:-1800}

# An unattended run has to fail rather than hang, so every wait below is bounded
function abort_if_timed_out() {
    # $1: deadline, $2: what is being waited for
    if (( SECONDS > $1 )); then
        echo ">>>>>> Timed out after ${WAIT_TIMEOUT_SECONDS}s waiting for $2" >&2
        exit 1
    fi
}

source ${SCRIPT_PATH}/../../../scripts/common-versions.env
REPO_VERSION=${jaia_version_release_branch}

FLEET_ID_HEX=$(printf '%x\n' ${FLEET_ID})
VPC_CIDR_BLOCK=$(jaia_ip --query_type net --ip_net vpc --fleet_id ${FLEET_ID} --ip_version ipv4)
# maps onto real fleet IP assignment
VIRTUALFLEET_WLAN_CIDR_BLOCK=$(jaia_ip --query_type net --ip_net vfleet_wlan --fleet_id ${FLEET_ID} --ip_version ipv4)
CLOUDHUB_CIDR_BLOCK=$(jaia_ip --query_type net --ip_net cloudhub_eth --fleet_id ${FLEET_ID} --ip_version ipv4)
CLOUDHUB_ID=30
CLOUDHUB_ETH_IP_ADDRESS=$(jaia_ip --query_type addr --ip_net cloudhub_eth --fleet_id ${FLEET_ID} --node_type hub --node_id ${CLOUDHUB_ID} --ip_version ipv4)

# IPv6 address to use for VirtualFleet VPN (fd6e:cf0d:aefa:FLEET_ID_HEX::/64)
VIRTUALFLEET_VPN_SERVER_IPV6=$(jaia_ip --query_type addr --ip_net vfleet_vpn --fleet_id ${FLEET_ID} --node_type hub --node_id ${CLOUDHUB_ID} --ip_version ipv6)
# IPv6 address to use for CloudHub VPN (fd0f:77ac:4fdf:FLEET_ID_HEX::/64)
CLOUDHUB_VPN_NETWORK_IPV6=$(jaia_ip --query_type net --ip_net cloudhub_vpn --fleet_id ${FLEET_ID} --ip_version ipv6)
CLOUDHUB_VPN_CLIENT_IPV6=$(jaia_ip --query_type addr --ip_net cloudhub_vpn --fleet_id ${FLEET_ID} --node_type desktop --node_id 1 --ip_version ipv6)
CLOUDHUB_VPN_SERVER_IPV6=$(jaia_ip --query_type addr --ip_net cloudhub_vpn --fleet_id ${FLEET_ID} --node_type hub --node_id ${CLOUDHUB_ID} --ip_version ipv6)

# generate Wireguard keys
CLIENT_VPN_WIREGUARD_PRIVATEKEY=$(wg genkey)
CLIENT_VPN_WIREGUARD_PUBKEY=$(echo $CLIENT_VPN_WIREGUARD_PRIVATEKEY | wg pubkey)

export AWS_DEFAULT_REGION=$REGION

# Checking the credentials rather than a named profile: CI authenticates with OIDC or with the environment
if ! ACCOUNT_ID=$(run ".Account" aws sts get-caller-identity); then
    echo -e "ERROR: no usable AWS credentials for region \033[1m${REGION}\033[0m. Add a profile to \033[1m$HOME/.aws/credentials\033[0m using the instructions at https://docs.aws.amazon.com/cli/latest/userguide/cli-authentication-user.html and select it with AWS_PROFILE, or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. Your identity must also hold the JaiaCloudCreation permissions."
    exit 1
fi

ARN_PREFIX="arn:aws"
if [[ $REGION == *"us-gov"* ]]; then
  ARN_PREFIX="arn:aws-us-gov"
fi

# Check that the VPC doesn't already exist
VPC_ID=$(run ".Vpcs[0].VpcId" aws ec2 describe-vpcs --filters "Name=tag:jaia_fleet,Values=${FLEET_ID}")

if [ "$VPC_ID" = "null" ] || [ -z "$VPC_ID" ]; then
    echo ">>>>>> Checked that VPC does not already exist for Fleet ${FLEET_ID}"
else
  echo "VPC exists for Fleet ${FLEET_ID}: $VPC_ID. You must delete it before running this script."
  exit 1
fi

# Find the newest AMI matching the tags
AMI_ID=$(run "." aws ec2 describe-images --filters "Name=tag:jaiabot-rootfs-gen_repository,Values=${REPO}" "Name=tag:jaiabot-rootfs-gen_repository_version,Values=${REPO_VERSION}" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId')

if [ "$AMI_ID" == "None" ]; then
    echo ">>>>>> No matching AMI found for repo: ${REPO} and version: ${REPO_VERSION}. Available AMIs include: "
    run "" aws ec2 describe-images --filters "Name=tag:jaiabot-rootfs-gen_repository,Values=*"
    exit 1
fi

echo ">>>>>> Newest matching AMI ID: $AMI_ID"

# Create the bucket if it doesn't exist
if run "" aws s3api head-bucket --bucket "$CLOUDHUB_DATA_BUCKET"; then
    echo ">>>>>> Bucket $CLOUDHUB_DATA_BUCKET already exists, no need to create"
else
    echo ">>>>>> Bucket $CLOUDHUB_DATA_BUCKET does not exist, creating..."

    # us-east-1 is the API's default and rejects being named as a location constraint
    location_args=()
    if [[ "$REGION" != "us-east-1" ]]; then
        location_args=(--create-bucket-configuration LocationConstraint="$REGION")
    fi
    run "" aws s3api create-bucket --bucket "$CLOUDHUB_DATA_BUCKET" --region "$REGION" "${location_args[@]}"
    on_rollback aws s3api delete-bucket --bucket "$CLOUDHUB_DATA_BUCKET"
fi

# Create a VPC, claiming the fleet in the same call: the check above reads these tags,
# so anything that applies them later leaves the fleet unclaimed for the whole create
CREATED_UNIXTIME=$(date -u +%s)
VPC_ID=$(run ".Vpc.VpcId" aws ec2 create-vpc --cidr-block "$VPC_CIDR_BLOCK" --amazon-provided-ipv6-cidr-block \
             --tag-specifications "ResourceType=vpc,Tags=[\
{Key=jaia_fleet,Value=${FLEET_ID}},\
{Key=jaia_customer,Value=${JAIA_CUSTOMER_NAME}},\
{Key=jaia_created_unixtime,Value=${CREATED_UNIXTIME}}]")
on_rollback aws ec2 delete-vpc --vpc-id $VPC_ID
echo ">>>>>> Created VPC with ID: $VPC_ID"

# Two runs can still both have passed the check above before either had tagged anything.
# Oldest tag wins the fleet, ties broken on ID, and the loser undoes itself rather than
# building a second fleet nobody can safely tear down.
winner=$(run '[.Vpcs[] | {id: .VpcId, t: ([.Tags[]? | select(.Key=="jaia_created_unixtime") | .Value][0] // "0" | tonumber)}] | sort_by(.t, .id) | .[0].id // ""' \
             aws ec2 describe-vpcs --filters "Name=tag:jaia_fleet,Values=${FLEET_ID}")
if [[ -n "$winner" && "$winner" != "$VPC_ID" ]]; then
    echo ">>>>>> Fleet ${FLEET_ID} was claimed by ${winner} at the same moment; standing down" >&2
    # The bucket is the fleet's rather than this run's, so the winner keeps it
    ROLLBACK_CMDS=("aws ec2 delete-vpc --vpc-id $VPC_ID")
    exit 1
fi

VPC_IPV6_BLOCK=$(run ".Vpcs[].Ipv6CidrBlockAssociationSet[].Ipv6CidrBlock" aws ec2 describe-vpcs --vpc-id ${VPC_ID})
echo ">>>>>> Created VPC IPV6 block: $VPC_IPV6_BLOCK"

# Create Policy for CloudHub to manage VirtualFleet instances
POLICY_FILE_IN="${SCRIPT_PATH}/cloudhub-iam-policy.json.in"
POLICY_FILE="${TMPDIR}/cloudhub-iam-policy.json"

cp ${POLICY_FILE_IN} ${POLICY_FILE}
sed -i "s/{{REGION}}/${REGION}/g" ${POLICY_FILE}
sed -i "s/{{ACCOUNT_ID}}/${ACCOUNT_ID}/g" ${POLICY_FILE}
sed -i "s/{{VPC_ID}}/${VPC_ID}/g" ${POLICY_FILE}
sed -i "s/{{CLOUDHUB_DATA_BUCKET}}/${CLOUDHUB_DATA_BUCKET}/g" ${POLICY_FILE}
sed -i "s/{{ARN_PREFIX}}/${ARN_PREFIX}/g" ${POLICY_FILE}

role_name="JaiaCloudHubFleet${FLEET_ID}__Role"
policy_name="JaiaCloudHubFleet${FLEET_ID}__Policy"
instance_profile_name="JaiaCloudHubFleet${FLEET_ID}__InstanceProfile"

echo ">>>>>> Checking if Instance Profile exists (NoSuchEntity errors are OK)"

if run "" aws iam get-instance-profile --instance-profile-name $instance_profile_name; then
    echo ">>>>>> Instance profile already exists. Deleting."
    run "" aws iam remove-role-from-instance-profile --instance-profile-name $instance_profile_name --role-name $role_name || true
    run "" aws iam delete-instance-profile --instance-profile-name $instance_profile_name
fi

echo ">>>>>> Checking if Role exists (NoSuchEntity errors are OK)"

if run "" aws iam get-role --role-name $role_name; then
    echo ">>>>>> Role already exists. Deleting."
    run "" aws iam delete-role-policy --role-name $role_name --policy-name $policy_name || true
    run "" aws iam delete-role --role-name $role_name
fi

echo ">>>>>> Creating role."
# A boundary caps what this role can ever be granted, so that whoever may write its
# inline policy cannot use it to escalate beyond the CloudHub's own job
boundary_args=()
if [[ -n "$CLOUDHUB_PERMISSIONS_BOUNDARY" ]]; then
    boundary_args=(--permissions-boundary "${ARN_PREFIX}:iam::${ACCOUNT_ID}:policy/${CLOUDHUB_PERMISSIONS_BOUNDARY}")
    echo ">>>>>> Bounding the role by ${CLOUDHUB_PERMISSIONS_BOUNDARY}"
fi
run "" aws iam create-role --role-name $role_name --assume-role-policy-document file://cloudhub-trust-policy.json "${boundary_args[@]}"
on_rollback aws iam delete-role --role-name $role_name
run "" aws iam put-role-policy --role-name $role_name --policy-name $policy_name --policy-document file://${POLICY_FILE}
on_rollback aws iam delete-role-policy --role-name $role_name --policy-name $policy_name

echo ">>>>>> Creating instance profile."
run "" aws iam create-instance-profile --instance-profile-name $instance_profile_name
on_rollback aws iam delete-instance-profile --instance-profile-name $instance_profile_name
run "" aws iam add-role-to-instance-profile --instance-profile-name $instance_profile_name --role-name $role_name
on_rollback aws iam remove-role-from-instance-profile --instance-profile-name $instance_profile_name --role-name $role_name

# Create an Internet Gateway
INTERNET_GATEWAY_ID=$(run ".InternetGateway.InternetGatewayId" aws ec2 create-internet-gateway)
on_rollback aws ec2 delete-internet-gateway --internet-gateway-id $INTERNET_GATEWAY_ID
echo ">>>>>> Created Internet Gateway with ID: $INTERNET_GATEWAY_ID"

# Attach the Internet Gateway to the VPC
run "" aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $INTERNET_GATEWAY_ID
on_rollback aws ec2 detach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $INTERNET_GATEWAY_ID
echo ">>>>>> Attached Internet Gateway to VPC"

# Create two subnets: 1) Cloudhub where eth0 which has the same IPv4 assignment as wlan0 in the real fleet, plus an IPv6 block and 2) VirtualFleet with just an IPv6 block
SUBNET_CLOUDHUB_IPV6=$(jaia_ip --query_type net --ip_net cloudhub_eth --fleet_id ${FLEET_ID} --ip_version ipv6 --ipv6_base ${VPC_IPV6_BLOCK})
SUBNET_CLOUDHUB_ID=$(run ".Subnet.SubnetId" aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block $CLOUDHUB_CIDR_BLOCK --ipv6-cidr-block $SUBNET_CLOUDHUB_IPV6 --availability-zone $AVAILABILITY_ZONE)
on_rollback aws ec2 delete-subnet --subnet-id $SUBNET_CLOUDHUB_ID
echo ">>>>>> Created CloudHub Subnet with ID: $SUBNET_CLOUDHUB_ID and IPv6: ${SUBNET_CLOUDHUB_IPV6}"
run "" aws ec2 modify-subnet-attribute --assign-ipv6-address-on-creation --subnet-id ${SUBNET_CLOUDHUB_ID}

SUBNET_VIRTUALFLEET_WLAN_IPV6=$(jaia_ip --query_type net --ip_net vfleet_wlan --fleet_id ${FLEET_ID} --ip_version ipv6 --ipv6_base ${VPC_IPV6_BLOCK})
SUBNET_VIRTUALFLEET_WLAN_ID=$(run ".Subnet.SubnetId" aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block $VIRTUALFLEET_WLAN_CIDR_BLOCK --ipv6-cidr-block $SUBNET_VIRTUALFLEET_WLAN_IPV6 --availability-zone $AVAILABILITY_ZONE)
on_rollback aws ec2 delete-subnet --subnet-id $SUBNET_VIRTUALFLEET_WLAN_ID
echo ">>>>>> Created VirtualFleet Subnet with ID: $SUBNET_VIRTUALFLEET_WLAN_ID and IPv6: ${SUBNET_VIRTUALFLEET_WLAN_IPV6}"
run "" aws ec2 modify-subnet-attribute --assign-ipv6-address-on-creation --subnet-id ${SUBNET_VIRTUALFLEET_WLAN_ID}

# Create a Security Group for CloudHub
CLOUDHUB_SECURITY_GROUP_ID=$(run '.GroupId' aws ec2 create-security-group --group-name "jaia__SecurityGroup_CloudHub__${JAIA_CUSTOMER_NAME}" --description "jaia__${JAIA_CUSTOMER_NAME} CloudHub Security Group" --vpc-id $VPC_ID)
on_rollback aws ec2 delete-security-group --group-id $CLOUDHUB_SECURITY_GROUP_ID
echo ">>>>>> Created CloudHub Security Group with ID: $CLOUDHUB_SECURITY_GROUP_ID"

# Set Up Security Group Rules
run "" aws ec2 authorize-security-group-ingress --group-id $CLOUDHUB_SECURITY_GROUP_ID --ip-permissions IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Allowed SSH (port 22) on Security Group"

run "" aws ec2 authorize-security-group-ingress --group-id $CLOUDHUB_SECURITY_GROUP_ID --ip-permissions IpProtocol=udp,FromPort=51820,ToPort=51821,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Allowed UDP ports 51820-51821 (Wireguard) on Security Group"

run "" aws ec2 authorize-security-group-ingress --group-id $CLOUDHUB_SECURITY_GROUP_ID --ip-permissions IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Allowed HTTP ports on Security Group"

run "" aws ec2 authorize-security-group-ingress --group-id $CLOUDHUB_SECURITY_GROUP_ID --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Allowed HTTPS ports on Security Group"

# Create a Security Group for VirtualFleet with no ingress rules allowed
VIRTUALFLEET_SECURITY_GROUP_ID=$(run '.GroupId' aws ec2 create-security-group --group-name "jaia__SecurityGroup_VirtualFleet__${JAIA_CUSTOMER_NAME}" --description "jaia__${JAIA_CUSTOMER_NAME} VirtualFleet Security Group" --vpc-id $VPC_ID)
on_rollback aws ec2 delete-security-group --group-id $VIRTUALFLEET_SECURITY_GROUP_ID
echo ">>>>>> Created VirtualFleet Security Group with ID: $VIRTUALFLEET_SECURITY_GROUP_ID"

# Allow all ingress on the local subnet (10.23.flt.0/24)
run "" aws ec2 authorize-security-group-ingress --group-id $VIRTUALFLEET_SECURITY_GROUP_ID --protocol all --port all --cidr $VIRTUALFLEET_WLAN_CIDR_BLOCK
echo ">>>>>> Allowed all ingress on for $VIRTUALFLEET_WLAN_CIDR_BLOCK"

# Modify the Main Route Table to use the Internet Gateway
ROUTE_TABLE_ID=$(run  '.RouteTables[0].RouteTableId' aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true")
run "" aws ec2 create-route --route-table-id $ROUTE_TABLE_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $INTERNET_GATEWAY_ID
run "" aws ec2 create-route --route-table-id $ROUTE_TABLE_ID --destination-ipv6-cidr-block ::/0 --gateway-id $INTERNET_GATEWAY_ID
echo ">>>>>> Modified the main route table to use the Internet Gateway"


# Allocate an Elastic IP Address
EIP_ALLOCATION_ID=$(run '.AllocationId' aws ec2 allocate-address)
on_rollback aws ec2 release-address --allocation-id $EIP_ALLOCATION_ID
echo ">>>>>> Allocated Elastic IP Address with Allocation ID: $EIP_ALLOCATION_ID"

PUBLIC_IPV4_ADDRESS=$(run ".Addresses[0].PublicIp" aws ec2 describe-addresses --allocation-ids $EIP_ALLOCATION_ID)

## Launch the actual VM (CloudHub)
USER_DATA_FIRST_BOOT_DIR=${TMPDIR}/bootdir
mkdir -p ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init

USER_DATA_COMMON=$(realpath ${SCRIPT_PATH}/../../customization/includes.chroot/etc/jaiabot/init/common-first-boot.yml)
USER_DATA_FIRST_BOOT_J2=$(realpath ${SCRIPT_PATH}/../../customization/includes.chroot/etc/jaiabot/init/first-boot.preseed.yml.j2)

cp ${USER_DATA_FIRST_BOOT_J2} ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init
jaia admin fleet generate ${FLEET_CONFIG} --bootdir ${USER_DATA_FIRST_BOOT_DIR} hub ${CLOUDHUB_ID} --action hub_ssh_keys --action vpn_key --action first_boot --action store_fleet_cfg --action write_cloudhub_env

# The closing summary reports the DNS and SMTP entries the operator still has to make
set -a; source <(grep '^AUTH_' ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/cloudhub_env.sh); set +a
USER_DATA_FIRST_BOOT=${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/first-boot.preseed.yml

USER_DATA_SCRIPT_IN="${SCRIPT_PATH}/cloud-init-user-data.sh.in"
USER_DATA_SCRIPT="${TMPDIR}/cloud-init-user-data.sh"

# replace some {{MACROS}} in the user data
cp ${USER_DATA_SCRIPT_IN} ${USER_DATA_SCRIPT}

declare -A replacements=(
    ["{{CLIENT_VPN_WIREGUARD_PUBKEY}}"]="$CLIENT_VPN_WIREGUARD_PUBKEY"
    ["{{FLEET_ID}}"]="$FLEET_ID"
)

for placeholder in "${!replacements[@]}"; do
    value=${replacements[$placeholder]}
    sed -i "s|$placeholder|$value|g" "${USER_DATA_SCRIPT}"
done

# Append SSH keys to user data script so they get installed
cat <<EOFF >> ${USER_DATA_SCRIPT}
## Install SSH keys
PRESEED_DIR="/boot/firmware/jaiabot/init"
mount -o remount,rw /boot/firmware
cat <<EOF > \${PRESEED_DIR}/hub${CLOUDHUB_ID}_fleet${FLEET_ID}
$(cat ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/hub${CLOUDHUB_ID}_fleet${FLEET_ID})
EOF

cat <<EOF > \${PRESEED_DIR}/hub${CLOUDHUB_ID}_fleet${FLEET_ID}.pub
$(cat ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/hub${CLOUDHUB_ID}_fleet${FLEET_ID}.pub)
EOF

## Values for cloud.env that AWS cannot be asked for
cat <<EOF > \${PRESEED_DIR}/cloudhub_env.sh
$(cat ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/cloudhub_env.sh)
EOF
EOFF

# Install Iridium configuration if it exists
if [ -e ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/iridium.json ]; then 
cat <<EOFF >> ${USER_DATA_SCRIPT}
## Install Iridium config
cat <<EOF > \${PRESEED_DIR}/iridium.json
$(cat ${USER_DATA_FIRST_BOOT_DIR}/jaiabot/init/iridium.json)
EOF
EOFF
fi 

USER_DATA_MIME=${USER_DATA_FIRST_BOOT_DIR}/user-data
USER_DATA_FILE=${USER_DATA_FIRST_BOOT_DIR}/user-data.gz
cloud-init devel make-mime -a ${USER_DATA_SCRIPT}:x-shellscript -a ${USER_DATA_COMMON}:cloud-config -a ${USER_DATA_FIRST_BOOT}:cloud-config > ${USER_DATA_MIME}
# EC2 limits user-data to 16 KB; cloud-init transparently decompresses gzip
gzip -9 -n -c ${USER_DATA_MIME} > ${USER_DATA_FILE}
echo ">>>>>> User data: $(stat -c %s ${USER_DATA_MIME}) bytes, $(stat -c %s ${USER_DATA_FILE}) bytes compressed (limit 16384)"

block_device_mappings_json=$(jq -n -c \
                  --arg volSize "$DISK_SIZE_GB" \
                  --arg volType "gp3" \
                  '[
                     {
                       "DeviceName": "/dev/sda1",
                       "Ebs": {
                         "VolumeSize": ($volSize | tonumber),
                         "VolumeType": $volType
                       }
                     }
                   ]')

# Construct the network interfaces JSON using jq
network_interfaces_json=$(jq -n -c \
                  --arg subnetId "$SUBNET_CLOUDHUB_ID" \
                  --arg privateIp "$CLOUDHUB_ETH_IP_ADDRESS" \
                  --arg groupId "$CLOUDHUB_SECURITY_GROUP_ID" \
                  '[
                     {
                       "DeviceIndex": 0,
                       "DeleteOnTermination": true,
                       "SubnetId": $subnetId,
                       "PrivateIpAddress": $privateIp,
                       "Groups": [$groupId]
                     }
                   ]')


# Launch the EC2 instance w/ two network interfaces
INSTANCE_ID=$(run ".Instances[0].InstanceId" aws ec2 run-instances \
                    --image-id "$AMI_ID" \
                    --instance-type "$INSTANCE_TYPE" \
                    --block-device-mappings "$block_device_mappings_json" \
                    --user-data fileb://"$USER_DATA_FILE" \
                    --network-interfaces "$network_interfaces_json" \
                    --iam-instance-profile "Name=$instance_profile_name")
on_rollback "aws ec2 terminate-instances --instance-ids $INSTANCE_ID && aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID"

echo ">>>>>> EC2 Instance launched successfully with ID: $INSTANCE_ID"

# Wait for the instance to be in a running state
echo ">>>>>> Waiting for instance to be in 'running' state..."
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
while state=$(run '.Reservations[].Instances[].State.Name' aws ec2 describe-instances --instance-ids $INSTANCE_ID); [ "$state" != "running" ]; do
  abort_if_timed_out $deadline "instance ${INSTANCE_ID} to reach the running state"
  exit_if_interrupted
  sleep 5
  echo ">>>>>> Instance state: $state"
done

ENI_ID_0=$(run ".NetworkInterfaces[0].NetworkInterfaceId" aws ec2 describe-network-interfaces --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" "Name=attachment.device-index,Values=0")
echo ">>>>>> ENI ID: $ENI_ID_0"

echo ">>>>>> Instance is running. Proceeding to associate Elastic IP Address."

# Associate the Elastic IP Address with the EC2 Instance
run "" aws ec2 associate-address --network-interface-id $ENI_ID_0 --allocation-id $EIP_ALLOCATION_ID
echo ">>>>>> Associated Elastic IP Address with EC2 Instance"

PUBLIC_IPV6_ADDRESS=$(run ".NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID_0")

# Tag the Resources
run "" aws ec2 create-tags --resources "$VPC_ID" \
    "$SUBNET_CLOUDHUB_ID" \
    "$SUBNET_VIRTUALFLEET_WLAN_ID" \
    "$CLOUDHUB_SECURITY_GROUP_ID" \
    "$INTERNET_GATEWAY_ID" \
    "$INSTANCE_ID" \
    "$ROUTE_TABLE_ID" \
    "$EIP_ALLOCATION_ID" \
    "$ENI_ID_0" \
    --tags \
    "Key=jaia_customer,Value=${JAIA_CUSTOMER_NAME}" \
    "Key=jaia_fleet,Value=${FLEET_ID}" \
    "Key=jaia_created_unixtime,Value=${CREATED_UNIXTIME}" \
    "Key=jaiabot-rootfs-gen_repository,Value=${REPO}" \
    "Key=jaiabot-rootfs-gen_repository_version,Value=${REPO_VERSION}"

run "" aws ec2 create-tags --resources "$VPC_ID"  --tags "Key=Name,Value=jaia__VPC__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$SUBNET_CLOUDHUB_ID"  --tags "Key=Name,Value=jaia__Subnet_CloudHub__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$SUBNET_VIRTUALFLEET_WLAN_ID"  --tags "Key=Name,Value=jaia__Subnet_VirtualFleet_WLAN__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$CLOUDHUB_SECURITY_GROUP_ID"  --tags "Key=Name,Value=jaia__SecurityGroup_CloudHub__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$VIRTUALFLEET_SECURITY_GROUP_ID"  --tags "Key=Name,Value=jaia__SecurityGroup_VirtualFleet__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$INTERNET_GATEWAY_ID"  --tags "Key=Name,Value=jaia__InternetGateway__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$ROUTE_TABLE_ID"  --tags "Key=Name,Value=jaia__RouteTable__${JAIA_CUSTOMER_NAME}"

# VM specific
run "" aws ec2 create-tags --resources "$INSTANCE_ID" --tags "Key=Name,Value=jaia__CloudHub_VM__${JAIA_CUSTOMER_NAME}" "Key=jaia_instance_type,Value=cloudhub"
run "" aws ec2 create-tags --resources "$EIP_ALLOCATION_ID" --tags "Key=Name,Value=jaia__CloudHub_VM__ElasticIP__${JAIA_CUSTOMER_NAME}"
run "" aws ec2 create-tags --resources "$ENI_ID_0" --tags "Key=Name,Value=jaia__CloudHub_VM__NetworkInterface0__${JAIA_CUSTOMER_NAME}"

run "" aws s3api put-bucket-tagging --bucket "$CLOUDHUB_DATA_BUCKET" --tagging "TagSet=[{Key=jaia_customer,Value=${JAIA_CUSTOMER_NAME}},{Key=jaia_fleet,Value=${FLEET_ID}}]"

echo ">>>>>> Tagged resources"

# No connection sharing: a ControlPersist master would hold the $(ssh ...) pipe open, and the server reboots mid-setup
SSH_OPTS=(-o ConnectTimeout=10 -o PasswordAuthentication=No -o StrictHostKeyChecking=no -o ControlMaster=no -o ControlPath=none -o ServerAliveInterval=10 -o ServerAliveCountMax=3)

# Wait to get public key
echo ">>>>>> Waiting for server to startup and first-boot configure to get Wireguard public key";
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
while SERVER_WIREGUARD_PUBKEY=$(ssh "${SSH_OPTS[@]}" jaia@${PUBLIC_IPV4_ADDRESS} "sudo cat /etc/wireguard/publickey" || echo Fail); [ "${SERVER_WIREGUARD_PUBKEY}" == "Fail" ]; do
    echo ">>>>>> Please keep waiting (Connection refused and Permission denied are *expected* for a while...)";
    abort_if_timed_out $deadline "the CloudHub to finish first boot and publish its Wireguard public key"
    exit_if_interrupted
    sleep 5
done

echo ">>>>>> Server Wireguard Pubkey: ${SERVER_WIREGUARD_PUBKEY}"

deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
while ! ssh "${SSH_OPTS[@]}" jaia@${PUBLIC_IPV4_ADDRESS} "mount | grep -q overlayroot"; do
    echo ">>>>>> Nearly there... please keep waiting (Connection refused and Permission denied are *expected* for a while...)";
    abort_if_timed_out $deadline "the CloudHub to reboot onto its overlay root"
    exit_if_interrupted
    sleep 5
done

AUTHELIA_ADMIN_PASSWORD=$(ssh "${SSH_OPTS[@]}" jaia@${PUBLIC_IPV4_ADDRESS} "sudo grep lldap_admin_password /var/log/jaiabot/auth/authelia/secrets | cut -d = -f2")
echo ">>>>>> Fetched Authelia initial admin password"

ssh "${SSH_OPTS[@]}" jaia@${PUBLIC_IPV4_ADDRESS} "sudo ufw allow in on eth0 proto udp to any port 51820; sudo ufw allow in on eth0 proto udp to any port 51821; sudo ufw allow in on wg_cloudhub; sudo ufw --force enable"
echo ">>>>>> Updated CloudHub ufw firewall rules to exclude connecting on VirtualFleet VPN"

run "" aws ec2 revoke-security-group-ingress --group-id $CLOUDHUB_SECURITY_GROUP_ID --ip-permissions IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Removed SSH (port 22) on Security Group"

exit_if_interrupted
# CloudHub is fully set up in AWS; failures after this point only affect local client configuration
ROLLBACK_ARMED=false
trap - INT TERM

if [[ -n "$OUTPUT_JSON" ]]; then
    jq -n \
       --arg region "$REGION" \
       --arg availability_zone "$AVAILABILITY_ZONE" \
       --arg fleet_id "$FLEET_ID" \
       --arg customer "$JAIA_CUSTOMER_NAME" \
       --arg repo "$REPO" \
       --arg repo_version "$REPO_VERSION" \
       --arg ami_id "$AMI_ID" \
       --arg instance_id "$INSTANCE_ID" \
       --arg vpc_id "$VPC_ID" \
       --arg cloudhub_subnet_id "$SUBNET_CLOUDHUB_ID" \
       --arg virtualfleet_subnet_id "$SUBNET_VIRTUALFLEET_WLAN_ID" \
       --arg cloudhub_security_group_id "$CLOUDHUB_SECURITY_GROUP_ID" \
       --arg virtualfleet_security_group_id "$VIRTUALFLEET_SECURITY_GROUP_ID" \
       --arg internet_gateway_id "$INTERNET_GATEWAY_ID" \
       --arg route_table_id "$ROUTE_TABLE_ID" \
       --arg eip_allocation_id "$EIP_ALLOCATION_ID" \
       --arg public_ipv4_address "$PUBLIC_IPV4_ADDRESS" \
       --arg cloudhub_vpn_server_ipv6 "$CLOUDHUB_VPN_SERVER_IPV6" \
       --arg virtualfleet_vpn_server_ipv6 "$VIRTUALFLEET_VPN_SERVER_IPV6" \
       --arg data_bucket "$CLOUDHUB_DATA_BUCKET" \
       --arg iam_role_name "$role_name" \
       --arg instance_profile_name "$instance_profile_name" \
       '$ARGS.named' > "$OUTPUT_JSON"
    echo ">>>>>> Wrote the created resource IDs to ${OUTPUT_JSON}"
fi

CLOUD_VPN=wg_jaia_ch${FLEET_ID}
cat <<EOF > /tmp/${CLOUD_VPN}.conf
[Interface]
# from /etc/wireguard/privatekey on client
PrivateKey = ...

# this client's VPN IP address
Address = ${CLOUDHUB_VPN_CLIENT_IPV6}/128

[Peer]
# Server public key (from /etc/wireguard/publickey on server)
PublicKey = ${SERVER_WIREGUARD_PUBKEY}

# Allowed private IPs
AllowedIPs = ${CLOUDHUB_VPN_NETWORK_IPV6}

# Server IP and port
Endpoint = ${PUBLIC_IPV4_ADDRESS}:51821

# Keep connection alive (required for behind NAT routers)
PersistentKeepalive = 52
EOF

sed -i "s|.*PrivateKey.*|PrivateKey = ${CLIENT_VPN_WIREGUARD_PRIVATEKEY}|" /tmp/${CLOUD_VPN}.conf

echo ">>>>>> Started CloudHub in Fleet $FLEET_ID:"
echo ">>>>>> Public IPv4 address: ${PUBLIC_IPV4_ADDRESS}"


if [[ "$ENABLE_CLIENT_VPN" == "true" ]]; then
    echo ">>>>>> Begin installing local VPN to /etc/wireguard/${CLOUD_VPN}.conf"

    sudo mv /tmp/${CLOUD_VPN}.conf /etc/wireguard
    sudo systemctl enable wg-quick@${CLOUD_VPN}
    sudo systemctl restart wg-quick@${CLOUD_VPN}

    echo ">>>>>> Enabled VPN:"
    sudo wg show ${CLOUD_VPN}
    deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
    while ! ping6 -c 1 "${CLOUDHUB_VPN_SERVER_IPV6}" &> /dev/null
    do
        echo ">>>>>> Waiting for CloudHub (${CLOUDHUB_VPN_SERVER_IPV6}) to respond (this may take several minutes)..."
        abort_if_timed_out $deadline "the CloudHub to answer over the ${CLOUD_VPN} tunnel"
        sleep 1
    done
    echo ">>>>>> Ping successful!"   
    echo -e ">>>>>> Now you can log in with\n\tjaia ssh chf${FLEET_ID} (ssh jaia@${CLOUDHUB_VPN_SERVER_IPV6})"
else
    echo ">>>>>> Prototype config for VPNs in /tmp/${CLOUD_VPN}.conf. You will need to enable this VPN to access the Cloudhub VM."
fi

if [[ "$UPDATE_CLIENT_ETC_HOSTS" == "true" ]]; then
    # Define the host entries
    CLOUDHUB_HOST="cloudhub-fleet${FLEET_ID}"

    # Update or append cloudhub entry in /etc/hosts
    if grep -q "$CLOUDHUB_HOST" /etc/hosts; then
        sudo sed -i "s/.* $CLOUDHUB_HOST\$/$CLOUDHUB_VPN_SERVER_IPV6 $CLOUDHUB_HOST/" /etc/hosts
    else
        echo "$CLOUDHUB_VPN_SERVER_IPV6 $CLOUDHUB_HOST" | sudo tee -a /etc/hosts
    fi
    echo -e ">>>>>> Updated /etc/hosts, so you can also log in with\n\tssh jaia@$CLOUDHUB_HOST"
fi


echo ">>>>>> SUCCESS"

AUTH_BASE_URI_HOST="${AUTH_BASE_URI%%.*}"

cat <<EOF
>>>>>> You must still perform these steps!
1. Add this server to your SMTP relay at (for $AUTH_SMTP_ADDRESS): $PUBLIC_IPV4_ADDRESS and $PUBLIC_IPV6_ADDRESS
2. Add these DNS entries:
	$AUTH_BASE_URI_HOST A $PUBLIC_IPV4_ADDRESS
	$AUTH_BASE_URI_HOST AAAA $PUBLIC_IPV6_ADDRESS
	*.$AUTH_BASE_URI_HOST CNAME $AUTH_BASE_URI
EOF

echo -e "Authelia login at https://$AUTH_BASE_URI\n\tuser: jaia_admin\n\tpass: $AUTHELIA_ADMIN_PASSWORD"
