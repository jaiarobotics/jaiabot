#!/bin/bash

set -u -e

# Overridable so this can be run against directories other than the live ones.
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"
CLOUD_ENV="${JAIA_CLOUD_ENV:-/etc/jaiabot/cloud.env}"
OUT_DIR="${JAIA_VPN_OUT_DIR:-/tmp}"
SYSCTL_DIR="${JAIA_SYSCTL_DIR:-/etc/sysctl.d}"

# What a client config carries in place of a key this server must never hold.
PRIVATE_KEY_PLACEHOLDER="REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

validate_pubkey()
{
    case "$1" in
        "" | *[!A-Za-z0-9+/=]*)
            echo "ERROR: '$1' is not a WireGuard public key" >&2
            exit 1
            ;;
    esac
    if [ ${#1} -ne 44 ]; then
        echo "ERROR: a WireGuard public key is 44 characters, '$1' is ${#1}" >&2
        exit 1
    fi
}

# Support both direct invocation and invocation via the jaia tool.
# When called via 'jaia admin vpn ...', the jaia tool passes '--binary=jaia admin vpn'
# as the first argument, which is used to display the correct command name in usage messages.
if [[ "${1:-}" == --binary=* ]]; then
    binary="${1#*=}"
    shift
else
    binary="$0"
fi

# Check if necessary parameters are provided
if (( "$#" < 2 )) || { [[ "$1" != "server_init" ]] && (( "$#" < 3 )); }; then
    echo "Usage: ${binary} cloudhub_vpn|vfleet_vpn bot|hub|desktop node_id client_pubkey"
    echo "       ${binary} fleet_vpn bot|hub|desktop node_id fleet_id [client_pubkey]"
    echo "       ${binary} server_init fleet_id [initial_client_pubkey]"
    echo
    echo "client_pubkey is 'wg genkey | wg pubkey' run on the node being added, so that"
    echo "its private half never leaves it. fleet_vpn may still omit it, since the server"
    echo "it runs on is not updated from this package."
    exit 1
fi

VPN_TYPE=$1
FLEET_ID=""

if [[ "$VPN_TYPE" = "server_init" ]]; then
    FLEET_ID=$2
    # Absent unless whoever built the CloudHub asked for a tunnel of their own
    INITIAL_CLIENT_PUBKEY=${3:-}
    if [ -n "${INITIAL_CLIENT_PUBKEY}" ]; then
        validate_pubkey "${INITIAL_CLIENT_PUBKEY}"
    fi
    # CLOUDHUB_ID=30: Hub ID for the CloudHub server node in the fleet
    CLOUDHUB_ID=30
    # INITIAL_CLIENT_NODE_ID=1: Desktop node ID 1 is used as the initial setup client
    INITIAL_CLIENT_NODE_ID=1

    ## Create sysctl settings for IP forwarding
    cat <<EOF | sudo tee ${SYSCTL_DIR}/wg.conf
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv6.conf.eth0.accept_ra = 2
EOF

    ## Create server WireGuard configs for CloudHub and VirtualFleet VPNs
    for vpn_type in virtualfleet cloudhub; do
        case "$vpn_type" in
            virtualfleet)
                title="VirtualFleet"
                port=51820
                vpn_net=vfleet_vpn
                ;;
            cloudhub)
                title="CloudHub VPN"
                port=51821
                vpn_net=cloudhub_vpn
                ;;
        esac

        server_ipv6=$(jaia_ip --query_type addr --node_type hub --node_id ${CLOUDHUB_ID} --fleet_id ${FLEET_ID} --ip_net ${vpn_net} --ip_version ipv6)
        client_ipv6=$(jaia_ip --query_type addr --node_type desktop --node_id ${INITIAL_CLIENT_NODE_ID} --fleet_id ${FLEET_ID} --ip_net ${vpn_net} --ip_version ipv6)

        cat <<EOF | sudo tee ${WG_DIR}/wg_${vpn_type}.conf
##########################
#### ${title} #########
###########################

[Interface]

# VPN Address for server
Address = ${server_ipv6}/64

# VPN Server Port
ListenPort = ${port}

# PrivateKey (contents of /etc/wireguard/privatekey)
PrivateKey = $(sudo cat ${WG_DIR}/privatekey)

PostUp = iptables -w 60 -A FORWARD -i wg_${vpn_type} -j ACCEPT; iptables -w 60 -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i eth0 -o wg_${vpn_type} -j ACCEPT; ip6tables -A FORWARD -i wg_${vpn_type} -j ACCEPT;
PostDown = iptables -w 60 -D FORWARD -i wg_${vpn_type} -j ACCEPT; iptables -w 60 -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i eth0 -o wg_${vpn_type} -j ACCEPT; ip6tables -D FORWARD -i wg_${vpn_type} -j ACCEPT;
EOF

        if [ -n "${INITIAL_CLIENT_PUBKEY}" ]; then
            sudo jaia-vpn-peers.sh add wg_${vpn_type} desktop${INITIAL_CLIENT_NODE_ID} "${INITIAL_CLIENT_PUBKEY}" "${client_ipv6}/128"
        fi
        sudo jaia-vpn-peers.sh enable wg_${vpn_type}
        sudo systemctl enable "wg-quick@wg_${vpn_type}"
    done
    exit 0
fi

NODE_TYPE=$2
NODE_ID=$3
IPVERSION="6"
SUBNET_BITS="128"

CLIENT_PUBKEY=""

if [[ "$VPN_TYPE" = "cloudhub_vpn" ]]; then
    set -a; source ${CLOUD_ENV}; set -a
    FLEET_ID=${jaia_fleet_id}
    SERVER_IP=${jaia_cloudhub_public_ipv4_address}
    
    WG_SERVER_PROFILE=wg_cloudhub
    WG_CLIENT_PROFILE=wg_jaia_ch${FLEET_ID}
    VPN_PORT=51821
    CLIENT_PUBKEY=${4:-}
elif [[ "$VPN_TYPE" = "vfleet_vpn" ]]; then
    set -a; source ${CLOUD_ENV}; set -a
    FLEET_ID=${jaia_fleet_id}
    SERVER_IP=${jaia_cloudhub_public_ipv4_address}

    WG_SERVER_PROFILE=wg_virtualfleet    
    WG_CLIENT_PROFILE=wg_jaia_vf${FLEET_ID}
    VPN_PORT=51820
    CLIENT_PUBKEY=${4:-}
elif [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    if [ "$#" != "4" ] && [ "$#" != "5" ]; then
        echo "For $VPN_TYPE, you must specify the fleet ID as the 4th command line parameter"
        exit 1
    fi
    FLEET_ID=$4
    CLIENT_PUBKEY=${5:-}
    SERVER_IP="vpn.jaia.tech"
    
    WG_SERVER_PROFILE=wg_fleet${FLEET_ID}
    WG_CLIENT_PROFILE=wg_jaia_sf${FLEET_ID}
    VPN_PORT=$((51821+${FLEET_ID}))
    # this VPN is IPv4 for the fleets whose id fits the 172.23.{fleet}.0/24 scheme, IPv6 above that
    if [ "${FLEET_ID}" -le "$(jaia_bounds --ipv4_fleet_id --max)" ]; then
        IPVERSION="4"
        SUBNET_BITS="32"
    fi
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn, vfleet_vpn, or fleet_vpn"
    exit 1
fi

CLIENT_IP=$(jaia_ip --query_type addr --node_type ${NODE_TYPE} --node_id ${NODE_ID} --fleet_id ${FLEET_ID} --ip_net ${VPN_TYPE} --ip_version ipv${IPVERSION})
NET=$(jaia_ip --query_type net --fleet_id ${FLEET_ID} --ip_net ${VPN_TYPE} --ip_version ipv${IPVERSION})

if [ -n "${CLIENT_PUBKEY}" ]; then
    validate_pubkey "${CLIENT_PUBKEY}"
    PRIVKEY=""
    PUBKEY=${CLIENT_PUBKEY}
elif [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    echo ">>> WARNING: no client public key given, so this server is generating the" >&2
    echo ">>> client's private key and writing it to ${OUT_DIR}. Pass the output of" >&2
    echo ">>> 'wg genkey | wg pubkey' from ${NODE_TYPE} ${NODE_ID} to avoid that." >&2
    PRIVKEY=$(wg genkey)
    PUBKEY=$(echo $PRIVKEY | wg pubkey)
else
    echo "ERROR: ${VPN_TYPE} needs the client's public key as the 4th parameter;" >&2
    echo "run 'wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey' on ${NODE_TYPE} ${NODE_ID}" >&2
    exit 1
fi

## Update server config


if [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    # the fleet VPN server is the gateway node on the fleet_vpn network
    SERVER_VPN_IP=$(jaia_ip --query_type addr --node_type gateway --ip_net fleet_vpn --fleet_id ${FLEET_ID} --ip_version ipv${IPVERSION})
    # Totally new fleet - add server config
    if ! sudo test -e ${WG_DIR}/${WG_SERVER_PROFILE}.conf; then
        cat <<EOF | sudo tee ${WG_DIR}/${WG_SERVER_PROFILE}.conf
###########################
#### Fleet ${FLEET_ID} ####
###########################

[Interface]

# VPN Address for server
Address = ${SERVER_VPN_IP}/${NET##*/}

# VPN Server Port
ListenPort = ${VPN_PORT}

# PrivateKey (contents of /etc/wireguard/privatekey)
PrivateKey = $(sudo cat ${WG_DIR}/privatekey)

# Note that this configuration uses NAT to make the VPN traffic appear to the rest of the Virtual Private Cloud (VPC) as if its coming from the VPN instance; this avoids the need for disabling the source/destination check or updating routing tables in EC2.
# update eth0 to the actual internet interface
PostUp = iptables -w 60 -A FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -w 60 -D FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -D POSTROUTING -o eth0 -j MASQUERADE

EOF
        sudo systemctl enable wg-quick@${WG_SERVER_PROFILE}
        
    fi
fi

if [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    sudo grep -q "${CLIENT_IP}/${SUBNET_BITS}" ${WG_DIR}/${WG_SERVER_PROFILE}.conf && (echo "${NODE_TYPE} ${NODE_ID} is already configured in ${WG_DIR}/${WG_SERVER_PROFILE}.conf. If you wish to continue, manually remove this Peer entry" && exit 1)

    cat <<EOF | sudo tee -a ${WG_DIR}/${WG_SERVER_PROFILE}.conf
# BEGIN PEER ${NODE_TYPE} ${NODE_ID}: CONFIGURED BY vpn_gen.sh
[Peer]
PublicKey = $PUBKEY
AllowedIPs = ${CLIENT_IP}/${SUBNET_BITS}
# END PEER ${NODE_TYPE} ${NODE_ID}: CONFIGURED BY vpn_gen.sh
EOF
else
    sudo jaia-vpn-peers.sh add ${WG_SERVER_PROFILE} ${NODE_TYPE}${NODE_ID} "$PUBKEY" "${CLIENT_IP}/${SUBNET_BITS}"
fi

## Generate client config
mkdir -p ${OUT_DIR}/${NODE_TYPE}${NODE_ID}
cat <<EOF > ${OUT_DIR}/${NODE_TYPE}${NODE_ID}/${WG_CLIENT_PROFILE}.conf
[Interface]
# from /etc/wireguard/privatekey on client
PrivateKey = ${PRIVKEY:-$PRIVATE_KEY_PLACEHOLDER}

# this client's VPN IP address
Address = ${CLIENT_IP}/${SUBNET_BITS}

[Peer]
# Server public key (from /etc/wireguard/publickey on server)
PublicKey = $(sudo cat ${WG_DIR}/publickey)

# Allowed private IPs
AllowedIPs = ${NET}

# Server IP and port
Endpoint = ${SERVER_IP}:${VPN_PORT}

# Keep connection alive (required for behind NAT routers)
PersistentKeepalive = 52
EOF
CLIENT_CONF=${OUT_DIR}/${NODE_TYPE}${NODE_ID}/${WG_CLIENT_PROFILE}.conf
if [ -n "${PRIVKEY}" ]; then
    echo ">>> SECURELY move ${CLIENT_CONF} to the client at /etc/wireguard/${WG_CLIENT_PROFILE}.conf"
    echo ">>> It holds a private key this server generated: delete this copy once it is moved."
else
    echo ">>> Move ${CLIENT_CONF} to the client at /etc/wireguard/${WG_CLIENT_PROFILE}.conf"
    echo ">>> It holds no private key. On the client, put its own in:"
    echo "sudo sed -i \"s|^PrivateKey =.*|PrivateKey = \$(sudo cat /etc/wireguard/privatekey)|\" /etc/wireguard/${WG_CLIENT_PROFILE}.conf"
fi
echo ">>> Then run:"
echo "sudo systemctl enable wg-quick@${WG_CLIENT_PROFILE} && sudo systemctl start wg-quick@${WG_CLIENT_PROFILE}"
if [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    echo ">>> Manually restart the server VPN (this may disconnect you!):"
    echo "sudo systemctl restart wg-quick@${WG_SERVER_PROFILE}"
else
    echo ">>> The peer is already live on ${WG_SERVER_PROFILE}; no restart is needed."
fi


if [[ "$VPN_TYPE" = "cloudhub_vpn" ]]; then
    SERVER_HOSTNAME=cloudhub-fleet${FLEET_ID}
    CLOUDHUB_ID=30
    SERVER_IP=$(jaia_ip h${CLOUDHUB_ID}cf${FLEET_ID})
    echo ">>> You may also wish to add this server's entry to /etc/hosts"
    echo "${SERVER_IP} ${SERVER_HOSTNAME}"
elif [[ "$VPN_TYPE" = "vfleet_vpn" ]]; then
    SERVER_HOSTNAME=hub1-virtualfleet${FLEET_ID}
    VHUB_ID=1
    SERVER_IP=$(jaia_ip --query_type addr --node_type hub --node_id ${VHUB_ID} --fleet_id ${FLEET_ID} --ip_net ${VPN_TYPE} --ip_version ipv6)
    echo ">>> You may also wish to add VirtualHub1's entry to /etc/hosts"
    echo "${SERVER_IP} ${SERVER_HOSTNAME}"
elif [[ "$VPN_TYPE" = "fleet_vpn" ]]; then
    # nothing to do here
    :
else
    echo "Invalid VPN: $VPN_TYPE; must be cloudhub_vpn, vfleet_vpn, or fleet_vpn"
    exit 1
fi
