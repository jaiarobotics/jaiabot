#!/bin/bash

set -u -e

# Check if necessary parameters are provided
if (( "$#" < 3 )); then
    echo "Usage: $0 cloudhub_vpn|vfleet_vpn|fleet_vpn bot|hub|desktop node_id [fleet_id (for fleet_vpn only)]"
    exit 1
fi


VPN_TYPE=$1
FLEET_ID=""
NODE_TYPE=$2
NODE_ID=$3
IPVERSION="6"
SUBNET_BITS="128"

if [[ "$VPN_TYPE" = "cloudhub_vpn" ]]; then
    set -a; source /etc/jaiabot/cloud.env; set -a
    FLEET_ID=${jaia_fleet_index}
    SERVER_IP=${jaia_cloudhub_public_ipv4_address}
    
    WG_SERVER_PROFILE=wg_cloudhub
    WG_CLIENT_PROFILE=wg_jaia_ch${FLEET_ID}
    VPN_PORT=51821
elif [[ "$VPN_TYPE" = "vfleet_vpn" ]]; then
    set -a; source /etc/jaiabot/cloud.env; set -a
    FLEET_ID=${jaia_fleet_index}
    SERVER_IP=${jaia_cloudhub_public_ipv4_address}

    WG_SERVER_PROFILE=wg_virtualfleet    
    WG_CLIENT_PROFILE=wg_jaia_vf${FLEET_ID}
    VPN_PORT=51820
elif [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    if [ "$#" != "4" ]; then
        echo "For $VPN_TYPE, you must specify the fleet ID as the 4th command line parameter"
        exit 1
    fi
    FLEET_ID=$4
    SERVER_IP="vpn.jaia.tech"
    
    WG_SERVER_PROFILE=wg_fleet${FLEET_ID}    
    WG_CLIENT_PROFILE=wg_jaia_sf${FLEET_ID}
    VPN_PORT=$((51821+${FLEET_ID}))
    IPVERSION="4"
    SUBNET_BITS="32"
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn, vfleet_vpn, or fleet_vpn"
    exit 1
fi

IP_PY="jaia-ip.py"
PRIVKEY=$(wg genkey)
PUBKEY=$(echo $PRIVKEY | wg pubkey)

CLIENT_IP=$(${IP_PY} addr --node ${NODE_TYPE} --node_id ${NODE_ID} --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv${IPVERSION})
NET=$(${IP_PY} net --fleet_id ${FLEET_ID} --net ${VPN_TYPE} --ipv${IPVERSION})

## Update server config


if [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    # Totally new fleet - add server config
    if ! sudo test -e /etc/wireguard/${WG_SERVER_PROFILE}.conf; then
        cat <<EOF | sudo tee /etc/wireguard/${WG_SERVER_PROFILE}.conf
###########################
#### Fleet ${FLEET_ID} ####
###########################

[Interface]

# VPN Address for server
Address = 172.23.${FLEET_ID}.1/24

# VPN Server Port
ListenPort = ${VPN_PORT}

# PrivateKey (contents of /etc/wireguard/privatekey)
PrivateKey = $(sudo cat /etc/wireguard/privatekey)

# Note that this configuration uses NAT to make the VPN traffic appear to the rest of the Virtual Private Cloud (VPC) as if its coming from the VPN instance; this avoids the need for disabling the source/destination check or updating routing tables in EC2.
# update eth0 to the actual internet interface
PostUp = iptables -w 60 -A FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -w 60 -D FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -D POSTROUTING -o eth0 -j MASQUERADE

EOF
        sudo systemctl enable wg-quick@${WG_SERVER_PROFILE}
        
    fi
fi

sudo grep -q "${CLIENT_IP}" /etc/wireguard/${WG_SERVER_PROFILE}.conf && (echo "${NODE_TYPE} ${NODE_ID} is already configured in /etc/wireguard/${WG_SERVER_PROFILE}.conf. If you wish to continue, manually remove this Peer entry" && exit 1)

cat <<EOF | sudo tee -a /etc/wireguard/${WG_SERVER_PROFILE}.conf
# BEGIN PEER ${NODE_TYPE} ${NODE_ID}: CONFIGURED BY vpn_gen.sh
[Peer]
PublicKey = $PUBKEY
AllowedIPs = ${CLIENT_IP}/${SUBNET_BITS}
# END PEER ${NODE_TYPE} ${NODE_ID}: CONFIGURED BY vpn_gen.sh
EOF

## Generate client config
mkdir -p /tmp/${NODE_TYPE}${NODE_ID}
cat <<EOF > /tmp/${NODE_TYPE}${NODE_ID}/${WG_CLIENT_PROFILE}.conf
[Interface]
# from /etc/wireguard/privatekey on client
PrivateKey = ${PRIVKEY}

# this client's VPN IP address
Address = ${CLIENT_IP}/${SUBNET_BITS}

[Peer]
# Server public key (from /etc/wireguard/publickey on server)
PublicKey = $(sudo cat /etc/wireguard/publickey)

# Allowed private IPs
AllowedIPs = ${NET}

# Server IP and port
Endpoint = ${SERVER_IP}:${VPN_PORT}

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
elif [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    # nothing to do here
    :
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn, vfleet_vpn, or fleet_vpn"
    exit 1
fi
