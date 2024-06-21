#!/bin/bash

set -u -e

# Check if necessary parameters are provided
if (( "$#" != 3 )); then
    echo "Usage: $0 cloudhub_vpn|vfleet_vpn hub|desktop node_id"
    exit 1
fi

set -a
source /etc/jaiabot/cloud.env
set -a

VPN_TYPE=$1
FLEET_ID=${jaia_fleet_index}
NODE_TYPE=$2
NODE_ID=$3

if [[ "$VPN_TYPE" = "cloudhub_vpn" ]]; then
    WG_SERVER_PROFILE=wg_cloudhub
    WG_CLIENT_PROFILE=wg_jaia_ch${FLEET_ID}
    VPN_PORT=51821
elif [[ "$VPN_TYPE" = "vfleet_vpn" ]]; then
    WG_SERVER_PROFILE=wg_virtualfleet    
    WG_CLIENT_PROFILE=wg_jaia_vf${FLEET_ID}
    VPN_PORT=51820
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn or vfleet_vpn"
    exit 1
fi

IP_PY="jaia-ip.py"
PRIVKEY=$(wg genkey)
PUBKEY=$(echo $PRIVKEY | wg pubkey)

CLIENT_IP=$(${IP_PY} addr --node ${NODE_TYPE} --node_id ${NODE_ID} --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv6)
NET=$(${IP_PY} net --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv6)

sudo grep -q "${CLIENT_IP}/128" /etc/wireguard/${WG_SERVER_PROFILE}.conf && (echo "${NODE_TYPE} ${NODE_ID} is already configured in /etc/wireguard/${WG_SERVER_PROFILE}.conf. If you wish to continue, manually remove this Peer entry" && exit 1)

cat <<EOF | sudo tee -a /etc/wireguard/${WG_SERVER_PROFILE}.conf
# BEGIN PEER ${NODE_TYPE} ${NODE_ID}: MANUALLY CONFIGURED
[Peer]
PublicKey = $PUBKEY
AllowedIPs = ${CLIENT_IP}/128
# END PEER ${NODE_TYPE} ${NODE_ID}: MANUALLY CONFIGURED
EOF

mkdir -p /tmp/${NODE_TYPE}${NODE_ID}
cat <<EOF > /tmp/${NODE_TYPE}${NODE_ID}/${WG_CLIENT_PROFILE}.conf
[Interface]
# from /etc/wireguard/privatekey on client
PrivateKey = ${PRIVKEY}

# this client's VPN IP address
Address = ${CLIENT_IP}/128

[Peer]
# Server public key (from /etc/wireguard/publickey on server)
PublicKey = $(sudo cat /etc/wireguard/publickey)

# Allowed private IPs
AllowedIPs = ${NET}

# Server IP and port
Endpoint = ${jaia_cloudhub_public_ipv4_address}:${VPN_PORT}

# Keep connection alive (required for behind NAT routers)
PersistentKeepalive = 52
EOF
echo ">>> SECURELY move /tmp/${NODE_TYPE}${NODE_ID}/${WG_CLIENT_PROFILE}.conf to client machine at /etc/wireguard/${WG_CLIENT_PROFILE}.conf and run:"
echo "sudo systemctl enable wg-quick@${WG_CLIENT_PROFILE} && sudo systemctl start wg-quick@${WG_CLIENT_PROFILE}"
echo ">>> Manually restart the server VPN (this may disconnect you!):"
echo "sudo systemctl restart wg-quick@${WG_SERVER_PROFILE}"


if [[ "$VPN_TYPE" = "cloudhub_vpn" ]]; then
    SERVER_HOSTNAME=cloudhub-fleet${FLEET_ID}
    CLOUDHUB_ID=30
    SERVER_IP=$(${IP_PY} addr --node hub --node_id ${CLOUDHUB_ID} --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv6)
    echo ">>> You may also wish to add this server's entry to /etc/hosts"
    echo "${SERVER_IP} ${SERVER_HOSTNAME}"
elif [[ "$VPN_TYPE" = "vfleet_vpn" ]]; then
    SERVER_HOSTNAME=hub1-virtualfleet${FLEET_ID}
    VHUB_ID=1
    SERVER_IP=$(${IP_PY} addr --node hub --node_id ${VHUB_ID} --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv6)
    echo ">>> You may also wish to add VirtualHub1's entry to /etc/hosts"
    echo "${SERVER_IP} ${SERVER_HOSTNAME}"
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn or vfleet_vpn"
    exit 1
fi
