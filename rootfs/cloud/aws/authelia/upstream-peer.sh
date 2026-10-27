#!/bin/bash
# Adds (or with --remove, removes) an auth server as a WireGuard peer of one upstream, and
# opens (or closes) the upstream's security group to it. Prints the upstream's public key
# for the conf. Run with GovCloud credentials (AWS_PROFILE); the upstream's own AWS account
# is reached with the conf's UPSTREAM_AWS_PROFILE. Run deploy.sh first: that makes the auth
# server's key.

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
upstream=$2
SSH_OPTS=${SSH_OPTS:-}

case $upstream in
    cc_db) upstream_address=$CC_DB_WG_ADDRESS; upstream_host=$CC_DB_SSH_HOST ;;
    data) upstream_address=$DATA_WG_ADDRESS; upstream_host=$DATA_SSH_HOST ;;
esac
wg_listen_port=51820

auth_public_key=$(aws ssm get-parameter --region "$REGION" --name "$AUTH_WG_PRIVATE_KEY_PARAMETER" \
                      --with-decryption --query Parameter.Value --output text | wg pubkey)

echo ">>>>>> $([ $remove = true ] && echo Removing || echo Adding) $SERVER_NAME as a peer of $upstream ($upstream_host)"
peer_script=$(cat <<'EOF'
set -e -u -o pipefail
server_name=$1 auth_public_key=$2 auth_address=$3 upstream_address=$4 port=$5 remove=$6
interface=wg_jaia_auth
conf=/etc/wireguard/$interface.conf
peers=/etc/wireguard/$interface.peers

command -v wg > /dev/null || sudo apt-get install -y -q wireguard-tools >&2 < /dev/null
sudo install -d -m 0700 "$peers"
if ! sudo test -f /etc/wireguard/$interface.key; then
    wg genkey | sudo tee /etc/wireguard/$interface.key > /dev/null
    sudo chmod 0600 /etc/wireguard/$interface.key
fi

if [ "$remove" = true ]; then
    sudo rm -f "$peers/$server_name.conf"
else
    printf '# %s\n[Peer]\nPublicKey = %s\nAllowedIPs = %s/128\n' \
        "$server_name" "$auth_public_key" "$auth_address" | sudo tee "$peers/$server_name.conf" > /dev/null
fi

# Apache listens on every address, the tunnel's included; the security group keeps
# port 80 off the public ones
sudo bash -s "$interface" "$upstream_address" "$port" <<'ASSEMBLE'
set -e -u
interface=$1 address=$2 port=$3
umask 077
{
    printf '[Interface]\nPrivateKey = %s\nAddress = %s/64\nListenPort = %s\n' \
        "$(cat /etc/wireguard/$interface.key)" "$address" "$port"
    for peer in /etc/wireguard/$interface.peers/*.conf; do
        [ -e "$peer" ] || continue
        printf '\n'
        cat "$peer"
    done
} > /etc/wireguard/$interface.conf.new
ASSEMBLE
if ! sudo cmp -s "$conf.new" "$conf"; then
    sudo mv "$conf.new" "$conf"
    if systemctl is-active --quiet wg-quick@$interface; then
        sudo bash -c "wg syncconf $interface <(wg-quick strip $interface)"
    else
        sudo systemctl enable --now wg-quick@$interface >&2
    fi
else
    sudo rm "$conf.new"
fi
sudo cat /etc/wireguard/$interface.key | wg pubkey
EOF
)
# The script as the remote command, not on stdin, which apt-get would read from
args=$(printf '%q ' "$SERVER_NAME" "$auth_public_key" "$AUTH_WG_ADDRESS" "$upstream_address" "$wg_listen_port" "$remove")
upstream_public_key=$(ssh $SSH_OPTS "jaia@$upstream_host" "set -- $args; $peer_script" < /dev/null)

security_group=$(aws ec2 describe-instances --profile "$UPSTREAM_AWS_PROFILE" --region "$UPSTREAM_REGION" \
                     --filters "Name=tag:jaia_server_type,Values=$upstream" "Name=instance-state-name,Values=running" \
                     --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)
permission=$(jq -n -c --argjson port $wg_listen_port --arg cidr "$IPV6_ADDRESS/128" --arg name "$SERVER_NAME" \
                 '[{IpProtocol: "udp", FromPort: $port, ToPort: $port,
                    Ipv6Ranges: [{CidrIpv6: $cidr, Description: ("WireGuard from " + $name)}]}]')
if $remove; then
    aws ec2 revoke-security-group-ingress --profile "$UPSTREAM_AWS_PROFILE" --region "$UPSTREAM_REGION" \
        --group-id "$security_group" --ip-permissions "$permission" > /dev/null || true
    echo ">>>>>> Closed UDP $wg_listen_port on $security_group to $IPV6_ADDRESS"
else
    if ! out=$(aws ec2 authorize-security-group-ingress --profile "$UPSTREAM_AWS_PROFILE" --region "$UPSTREAM_REGION" \
                   --group-id "$security_group" --ip-permissions "$permission" 2>&1); then
        grep -q InvalidPermission.Duplicate <<< "$out" || { echo "$out" >&2; exit 1; }
    fi
    echo ">>>>>> Opened UDP $wg_listen_port on $security_group to $IPV6_ADDRESS"
    echo
    echo "Set in $1 (or its base conf) and run deploy.sh again:"
    echo "  ${upstream^^}_WG_PUBLIC_KEY=$upstream_public_key"
fi
