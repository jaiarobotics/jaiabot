#!/bin/bash
set -u -e

SCRIPT_PATH=$(dirname "$0")
source ${SCRIPT_PATH}/includes/aws_run.sh

if (( "$#" != 1 )); then
    echo "Usage: $0 server.conf"
    exit 1
fi

ARCH=arm64
INSTANCE_TYPE=t4g.nano
REGION=us-west-2
# default subnet for jaia servers in us-west-2
SUBNET_ID=subnet-f5f17b8d
DISK_SIZE_GB=8
ELASTIC_IP_ALLOCATION_ID=
CREATE_NUM_DAILY_BACKUPS=1
IPV6_ADDRESS=
IAM_INSTANCE_PROFILE_NAME=

set -a; source $1; set +a;

if [[ ! -d ${SCRIPT_PATH}/${SERVER_TYPE} ]]; then
   echo "${SERVER_TYPE} is not a valid SERVER_TYPE"
   exit 1
fi

if [[ "$DEBUG" = "true" ]]; then
    echo "Using tmp dir: ${TMPDIR}"
fi

export AWS_DEFAULT_REGION=$REGION

set -a; source ${SCRIPT_PATH}/../../../scripts/common-versions.env; set +a;

# Get latest Ubuntu AMI
AMI_ID=$(run '.Parameters[0].Value' aws ssm get-parameters --names /aws/service/canonical/ubuntu/server/${jaia_version_ubuntu}/stable/current/${ARCH}/hvm/ebs-gp3/ami-id)

# Create a Security Group
SECURITY_GROUP_ID=$(run '.GroupId' aws ec2 create-security-group --group-name "jaia__SecurityGroup_${SERVER_TYPE}_$(date -Iminutes -u)" --description "jaia ${SERVER_TYPE} Security Group")
echo ">>>>>> Created ${SERVER_TYPE} Security Group with ID: $SECURITY_GROUP_ID"

create_security_group_rules ${SECURITY_GROUP_ID}

network_interfaces_json=$(jq -n -c \
                  --arg subnetId "$SUBNET_ID" \
                  --arg groupId "$SECURITY_GROUP_ID" \
                  '[
                     {
                       "DeviceIndex": 0,
                       "DeleteOnTermination": true,
                       "SubnetId": $subnetId,
                       "Groups": [$groupId]
                     }
                   ]')


if [[ ! -z "${IPV6_ADDRESS}" ]]; then
    network_interfaces_json=$(echo $network_interfaces_json | jq -c --arg ipv6 "${IPV6_ADDRESS}" '.[0] += {"Ipv6Addresses": [{"Ipv6Address": $ipv6}]}')
fi


USER_DATA_SCRIPT="${SCRIPT_PATH}/${SERVER_TYPE}/user-data.sh"
USER_DATA_SCRIPT_TMPL="${SCRIPT_PATH}/${SERVER_TYPE}/user-data.sh.in"

# only substitute variables that are actually defined
subst_vars=$(env | sed 's/=.*//' | sed 's/.*/${&}/' | tr '\n' ' ')
if [[ -e ${USER_DATA_SCRIPT} ]]; then
    :
elif [[ -e ${USER_DATA_SCRIPT_TMPL} ]]; then
    USER_DATA_SCRIPT="${TMPDIR}/user-data.sh"
    envsubst "$subst_vars" < ${USER_DATA_SCRIPT_TMPL} > ${USER_DATA_SCRIPT}
fi

USER_DATA_CORE_IN="${SCRIPT_PATH}/${SERVER_TYPE}/user-data.yaml.in"
USER_DATA_CORE="${TMPDIR}/user-data.yaml"

envsubst "$subst_vars" < ${USER_DATA_CORE_IN} > ${USER_DATA_CORE}

USER_DATA_FILE=${TMPDIR}/user-data
cloud-init devel make-mime -a ${USER_DATA_SCRIPT}:x-shellscript -a ${USER_DATA_CORE}:cloud-config > ${USER_DATA_FILE}


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


# Build optional IAM instance profile argument
iam_instance_profile_args=()
if [[ ! -z "${IAM_INSTANCE_PROFILE_NAME}" ]]; then
    iam_instance_profile_args=(--iam-instance-profile "Name=${IAM_INSTANCE_PROFILE_NAME}")
fi

# Launch the EC2 instance
INSTANCE_ID=$(run ".Instances[0].InstanceId" aws ec2 run-instances \
                    --image-id "$AMI_ID" \
                    --instance-type "$INSTANCE_TYPE" \
                    --block-device-mappings "$block_device_mappings_json" \
                    --user-data file://"$USER_DATA_FILE" \
                    --network-interfaces "$network_interfaces_json" \
                    "${iam_instance_profile_args[@]}")

echo ">>>>>> EC2 Instance launched successfully with ID: $INSTANCE_ID"

if [[ "${ENABLE_TERMINATION_PROTECTION}" = "true" ]]; then
    run "" aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --disable-api-termination "{\"Value\":true}"
    echo ">>>>>> Termination protection enabled"
fi
    
# Wait for the instance to be in a running state
echo ">>>>>> Waiting for instance to be in 'running' state..."
while state=$(run '.Reservations[].Instances[].State.Name' aws ec2 describe-instances --instance-ids $INSTANCE_ID); [ "$state" != "running" ]; do
  sleep 5
  echo ">>>>>> Instance state: $state"
done

ENI_ID_0=$(run ".NetworkInterfaces[0].NetworkInterfaceId" aws ec2 describe-network-interfaces --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" "Name=attachment.device-index,Values=0")
echo ">>>>>> ENI ID: $ENI_ID_0"

if [[ ! -z "${ELASTIC_IP_ALLOCATION_ID}" ]]; then
    echo ">>>>>> Instance is running. Proceeding to associate Elastic IP Address."

    # Associate the Elastic IP Address with the EC2 Instance
    run "" aws ec2 associate-address --network-interface-id $ENI_ID_0 --allocation-id $ELASTIC_IP_ALLOCATION_ID
    echo ">>>>>> Associated Elastic IP Address with EC2 Instance"
else
    echo ">>>>>> Instance is running. Not associating Elastic IP Address as ELASTIC_IP_ALLOCATION_ID is not set"
fi


echo ">>>>>> Tagging resources"

run "" aws ec2 create-tags --resources "$INSTANCE_ID" \
    "$SECURITY_GROUP_ID" \
    --tags \
    "Key=jaia_server_type,Value=${SERVER_TYPE}"

SERVER_NAME="${SERVER_TYPE}.jaia.tech"

run "" aws ec2 create-tags --resources "$INSTANCE_ID" --tags "Key=Name,Value=${SERVER_NAME}"
run "" aws ec2 create-tags --resources "$SECURITY_GROUP_ID" --tags "Key=Name,Value=${SERVER_NAME} Security Group"

VOLUME=$(run ".Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId" aws ec2 describe-instances  --instance-ids "$INSTANCE_ID")

run "" aws ec2 create-tags --resources "$VOLUME" --tags "Key=Name,Value=${SERVER_NAME}"

echo ">>>>>> Tagged resources"

if [[ $CREATE_NUM_DAILY_BACKUPS -gt 0 ]]; then
    echo ">>>>>> Creating DLM (Backup) Policy, keep ${CREATE_NUM_DAILY_BACKUPS} days"

    # Find policy ID(s) matching the target tag
    POLICY_IDS=$(run ".[].PolicyId" aws dlm get-lifecycle-policies --query "Policies[?Tags.Name=='"${SERVER_NAME}"']")

    # Delete existing policy/policies if found
    if [[ -n "$POLICY_IDS" ]]; then
        echo "Found existing policy(ies): $POLICY_IDS - deleting..."
        for PID in $POLICY_IDS; do
            run "" aws dlm delete-lifecycle-policy \
                --region "$REGION" \
                --policy-id "$PID"
        done
    else
        echo "No existing policies found for tag Name=${SERVER_NAME}"
    fi
    
    # Create new policy
    ACCOUNT_ID=$(run ".Account" aws sts get-caller-identity)
    DLM_ROLE=arn:aws:iam::${ACCOUNT_ID}:role/service-role/AWSDataLifecycleManagerDefaultRole
    if [[ $REGION == *"us-gov"* ]]; then
        DLM_ROLE=arn:aws-us-gov:iam::${ACCOUNT_ID}:role/AWSDataLifecycleManagerDefaultRole
    fi
    NEW_POLICY_ID=$(run ".PolicyId" aws dlm create-lifecycle-policy \
        --region "$REGION" \
        --execution-role-arn ${DLM_ROLE} \
        --description "Daily snapshots for ${SERVER_TYPE}" \
        --state ENABLED \
        --tags "Name=${SERVER_NAME}" \
        --policy-details '{
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [
      {"Key": "Name", "Value": "'"${SERVER_NAME}"'"}
    ],
    "Schedules": [
      {
        "Name": "DailySnapshots",
        "CopyTags": true,
        "TagsToAdd": [
          {"Key": "CreatedBy", "Value": "DLM"}
        ],
        "CreateRule": {
          "Interval": 24,
          "IntervalUnit": "HOURS",
          "Times": ["00:00"]
        },
        "RetainRule": {
          "Count": 0,
          "Interval": '"$CREATE_NUM_DAILY_BACKUPS"',
          "IntervalUnit": "DAYS"
        }
      }
    ]
  }')

    echo ">>>>>> Created DLM Policy"
fi

PUB_IPV4_ADDRESS=$(run ".Reservations[0].Instances[0].PublicIpAddress" aws ec2 describe-instances --instance-ids $INSTANCE_ID)

echo ">>>>>> SUCCESS"

echo "You can login in with:"
echo "ssh jaia@${PUB_IPV4_ADDRESS}"

