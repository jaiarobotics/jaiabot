#!/bin/bash
# Opens (or with --remove, closes) one upstream's port to an auth server: its security group
# admits the auth server's security group, so the rule outlives the auth server's addresses.

set -u -e -o pipefail

remove=false
if [ "${1:-}" = "--remove" ]; then
    remove=true
    shift
fi
if (( $# != 2 )) || [[ "$2" != cc_db && "$2" != data ]]; then
    echo "Usage: $0 [--remove] authelia/authelia.conf cc_db|data"
    exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
set -a; source "$1"; set +a
export AWS_DEFAULT_REGION=$REGION
upstream=$2

case $upstream in
    cc_db) upstream_address=$CC_DB_UPSTREAM ;;
    data) upstream_address=$DATA_UPSTREAM ;;
esac
port=${upstream_address##*:}

auth_group=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=$SERVER_NAME Security Group" \
                 --query 'SecurityGroups[0].GroupId' --output text)
if [ "$auth_group" = None ]; then
    echo "No security group tagged \"$SERVER_NAME Security Group\"; create the server first" >&2
    exit 1
fi

read -r upstream_group upstream_ip < <(aws ec2 describe-instances \
    --filters "Name=tag:jaia_server_type,Values=$upstream" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].[SecurityGroups[0].GroupId,PrivateIpAddress]' --output text)
if [ "$upstream_ip" != "${upstream_address%:*}" ]; then
    echo "WARNING: $upstream's private address is $upstream_ip, but the conf proxies to $upstream_address" >&2
fi

permission=$(jq -n -c --argjson port "$port" --arg group "$auth_group" --arg name "$SERVER_NAME" \
                 '[{IpProtocol: "tcp", FromPort: $port, ToPort: $port,
                    UserIdGroupPairs: [{GroupId: $group, Description: ("Signed in through " + $name)}]}]')
if $remove; then
    aws ec2 revoke-security-group-ingress --group-id "$upstream_group" --ip-permissions "$permission" > /dev/null || true
    echo ">>>>>> Closed TCP $port on $upstream ($upstream_group) to $SERVER_NAME ($auth_group)"
else
    if ! out=$(aws ec2 authorize-security-group-ingress --group-id "$upstream_group" \
                   --ip-permissions "$permission" 2>&1); then
        grep -q InvalidPermission.Duplicate <<< "$out" || { echo "$out" >&2; exit 1; }
    fi
    echo ">>>>>> Opened TCP $port on $upstream ($upstream_group) to $SERVER_NAME ($auth_group)"
fi
