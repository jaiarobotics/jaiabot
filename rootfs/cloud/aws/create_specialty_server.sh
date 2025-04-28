#!/bin/bash
set -u -e

SCRIPT_PATH=$(dirname "$0")
source ${SCRIPT_PATH}/includes/aws_run.sh

if (( "$#" != 1 )); then
    echo "Usage: $0 server.conf"
    exit 1
fi

source $1

if [[ ! -d ${SCRIPT_PATH}/${SERVER_TYPE} ]]; then
   echo "${SERVER_TYPE} is not a valid SERVER_TYPE"
   exit 1
fi

ARCH=arm64
INSTANCE_TYPE=t4g.nano
REGION=us-west-2
# default subnet for jaia servers in us-west-2
SUBNET_ID=subnet-f5f17b8d

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

# Set Up Security Group Rules
run "" aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --ip-permissions IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]',Ipv6Ranges='[{CidrIpv6=::/0}]'
echo ">>>>>> Allowed SSH (port 22) on Security Group"

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


USER_DATA_SCRIPT_IN="${SCRIPT_PATH}/${SERVER_TYPE}/user-data.sh.in"
USER_DATA_SCRIPT="${TMPDIR}/user-data.sh"

ROOT_PUBKEYS=$(cat ${SCRIPT_PATH}/../../../config/ssh/root_authorized_keys)
eval "echo \"$(< ${USER_DATA_SCRIPT_IN})\"" > ${USER_DATA_SCRIPT}
USER_DATA_CORE=${SCRIPT_PATH}/${SERVER_TYPE}/user-data
USER_DATA_FILE=${TMPDIR}/user-data
cloud-init devel make-mime -a ${USER_DATA_SCRIPT}:x-shellscript -a ${USER_DATA_CORE}:cloud-config > ${USER_DATA_FILE}

# Launch the EC2 instance
INSTANCE_ID=$(run ".Instances[0].InstanceId" aws ec2 run-instances \
                    --image-id "$AMI_ID" \
                    --instance-type "$INSTANCE_TYPE" \
                    --user-data file://"$USER_DATA_FILE" \
                    --network-interfaces "$network_interfaces_json")

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

echo ">>>>>> Instance is running. Proceeding to associate Elastic IP Address."

# Associate the Elastic IP Address with the EC2 Instance
run "" aws ec2 associate-address --network-interface-id $ENI_ID_0 --allocation-id $ELASTIC_IP_ALLOCATION_ID
echo ">>>>>> Associated Elastic IP Address with EC2 Instance"

run "" aws ec2 create-tags --resources "$INSTANCE_ID" \
    "$SECURITY_GROUP_ID" \
    --tags \
    "Key=jaia_server_type,Value=${SERVER_TYPE}"

run "" aws ec2 create-tags --resources "$INSTANCE_ID" --tags "Key=Name,Value=${SERVER_TYPE}.jaia.tech"
run "" aws ec2 create-tags --resources "$SECURITY_GROUP_ID" --tags "Key=Name,Value=${SERVER_TYPE}.jaia.tech Security Group"

echo ">>>>>> Tagged resources"

echo ">>>>>> SUCCESS"
