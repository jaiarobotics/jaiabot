#!/bin/bash
# Moves the old auth server's Elastic IP and IPv6 address, which *.cloud.jaia.tech point at,
# to the new one; --rollback moves them back. Run migrate-from.sh --final first.

set -u -e -o pipefail

rollback=false
if [ "${1:-}" = "--rollback" ]; then
    rollback=true
    shift
fi
if (( $# != 1 )); then
    echo "Usage: $0 [--rollback] authelia/authelia.conf"
    exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
set -a; source "$1"; set +a
export AWS_DEFAULT_REGION=$REGION
SSH_OPTS=${SSH_OPTS:-}

if [ -z "$CUTOVER_FROM_INSTANCE_ID" ]; then
    echo "$1 names no server to take over (CUTOVER_FROM_INSTANCE_ID)" >&2
    exit 1
fi

new_instance=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=$SERVER_NAME" "Name=instance-state-name,Values=running" \
    --query "Reservations[].Instances[?InstanceId!='$CUTOVER_FROM_INSTANCE_ID'][].InstanceId" --output text)
if [ -z "$new_instance" ] || [[ "$new_instance" == *[[:space:]]* ]]; then
    echo "Expected one running instance named $SERVER_NAME besides $CUTOVER_FROM_INSTANCE_ID, found: ${new_instance:-none}" >&2
    exit 1
fi

eni()
{
    aws ec2 describe-instances --instance-ids "$1" \
        --query 'Reservations[0].Instances[0].NetworkInterfaces[?Attachment.DeviceIndex==`0`].NetworkInterfaceId' --output text
}
old_eni=$(eni "$CUTOVER_FROM_INSTANCE_ID")
new_eni=$(eni "$new_instance")

if $rollback; then
    from=$new_instance from_eni=$new_eni to=$CUTOVER_FROM_INSTANCE_ID to_eni=$old_eni
else
    from=$CUTOVER_FROM_INSTANCE_ID from_eni=$old_eni to=$new_instance to_eni=$new_eni
fi

public_ip=$(aws ec2 describe-addresses --allocation-ids "$CUTOVER_ELASTIC_IP_ALLOCATION_ID" \
                --query 'Addresses[0].PublicIp' --output text)
echo "Moving $public_ip and $CUTOVER_IPV6_ADDRESS from $from ($from_eni) to $to ($to_eni)"
read -r -p "Type the instance id they move to ($to) to go ahead: " answer
if [ "$answer" != "$to" ]; then
    echo "Not moved"
    exit 1
fi

on_eni()
{
    aws ec2 describe-network-interfaces --network-interface-ids "$1" \
        --query "NetworkInterfaces[0].Ipv6Addresses[?Ipv6Address=='$CUTOVER_IPV6_ADDRESS'] | length(@)" --output text
}
if [ "$(on_eni "$from_eni")" = 1 ]; then
    aws ec2 unassign-ipv6-addresses --network-interface-id "$from_eni" --ipv6-addresses "$CUTOVER_IPV6_ADDRESS" > /dev/null
fi
if [ "$(on_eni "$to_eni")" = 0 ]; then
    aws ec2 assign-ipv6-addresses --network-interface-id "$to_eni" --ipv6-addresses "$CUTOVER_IPV6_ADDRESS" > /dev/null
fi
echo ">>>>>> Moved $CUTOVER_IPV6_ADDRESS"

aws ec2 associate-address --allocation-id "$CUTOVER_ELASTIC_IP_ALLOCATION_ID" --network-interface-id "$to_eni" \
    --allow-reassociation > /dev/null
echo ">>>>>> Moved $public_ip"

# The instance learns of an added IPv6 address at its next DHCPv6 renewal unless asked now
echo ">>>>>> Renewing the network configuration on $to"
ssh $SSH_OPTS -o StrictHostKeyChecking=accept-new "jaia@$public_ip" \
    'sudo networkctl renew "$(ip -o -4 route show default | awk "{print \$5}")"' || true
for _ in $(seq 1 30); do
    if ssh $SSH_OPTS "jaia@$public_ip" "ip -6 addr show | grep -q '$CUTOVER_IPV6_ADDRESS'"; then
        echo ">>>>>> $to answers at $public_ip and $CUTOVER_IPV6_ADDRESS"
        exit 0
    fi
    sleep 2
done
echo "WARNING: $to does not show $CUTOVER_IPV6_ADDRESS yet; check its network configuration" >&2
exit 1
