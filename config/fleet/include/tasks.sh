ANSIBLE_INVENTORY=/tmp/jaiabot-ansible-inventory.yml
ANSIBLE_VFLEET_INVENTORY=/tmp/jaiabot-ansible-vfleet-inventory.yml

function generate_and_exchange_keys() {
    local entity_type=$1 # "bot" or "hub"
    local entity_ids=$2 # BOT_IDS or HUB_IDS
    local related_entity_type=$3 # opposite of entity_type
    local related_entity_ids=$4 # opposite of entity_ids

    for ENTITY_ID_QUOTED in ${entity_ids}
    do
        ENTITY_ID=$(eval echo $ENTITY_ID_QUOTED)
        ENTITY_IP=$(eval ${entity_type}_ip ${ENTITY_ID})
        echo "#############################################################"
        echo "========= GENERATE SSH KEY PAIR: ${entity_type^^} ${ENTITY_ID} =============="
        echo "#############################################################"
        ENTITY_NAME=${entity_type}${ENTITY_ID}_fleet${FLEET_ID}
        ENTITY_KEYFILE=/home/jaia/.ssh/id_${ENTITY_NAME}
        # 1. remove any overlay ssh files
        # 2. remove known_hosts file
        # 3. remove old key (if exists)
        # 4. create new key
        # 5. set .ssh/config to use key without "-i"
        $SSH jaia@${ENTITY_IP} \
             "rm -f /media/root-rw/overlay/home/jaia/.ssh/*;" \
             $RO_CMD "rm -f /home/jaia/.ssh/known_hosts;" \
             $RO_CMD "rm -f ${ENTITY_KEYFILE} ${ENTITY_KEYFILE}.pub;" \
             $RO_CMD "ssh-keygen -t ed25519 -N '' -f ${ENTITY_KEYFILE} -C $ENTITY_NAME;" \
             $RO_CMD "bash -c \"grep -q IdentityFile\\ ${ENTITY_KEYFILE} /home/jaia/.ssh/config || echo IdentityFile ${ENTITY_KEYFILE} >> /home/jaia/.ssh/config\"; "
        
        ENTITY_PUBKEY=$($SSH jaia@${ENTITY_IP} cat /media/root-ro${ENTITY_KEYFILE}.pub)

        echo "${entity_type^^} ${ENTITY_ID} Public Key: ${ENTITY_PUBKEY}"

        for RELATED_ENTITY_ID_QUOTED in ${related_entity_ids}
        do    
            RELATED_ENTITY_ID=$(echo $RELATED_ENTITY_ID_QUOTED | xargs)
            RELATED_ENTITY_IP=$(eval ${related_entity_type}_ip ${RELATED_ENTITY_ID})

            # returns same IP address as RELATED_ENTITY_IP for real fleet, but for virtualbox returns the real 10.23.x.y IP address rather than the ssh config name
            RELATED_ENTITY_IP_INTERNAL=$(eval ${related_entity_type}_ip ${RELATED_ENTITY_ID} "internal")
            echo "##########################################################"
            echo "======= UPDATE ${related_entity_type^^} ${RELATED_ENTITY_ID} WITH ${entity_type^^} ${ENTITY_ID} KEY =============="
            echo "##########################################################"
            # 1. remove old pub key (if exists) from authorized keys
            # 2. add new pub key to authorized keys
            $SSH jaia@${RELATED_ENTITY_IP} \
                 $RO_CMD "sed -i \"/.* ${ENTITY_NAME}/d\" /home/jaia/.ssh/authorized_keys;" \
                 $RO_CMD "bash -c \"echo ${ENTITY_PUBKEY} >> /home/jaia/.ssh/authorized_keys\"; "

            echo "OK"
            
            echo "##########################################################"
            echo "======= UPDATE ${entity_type^^} ${ENTITY_ID} .ssh/known_hosts and /etc/hosts FOR ${related_entity_type^^} ${RELATED_ENTITY_ID}  =============="
            echo "##########################################################"           
            # 1. add ip address to known_hosts (to avoid first log-on prompt). Warning - this means we are susceptible to a man-in-the-middle-attack
            # while configuring the fleet, but as this should be done in a controlled environment it should be OK.           
            # 2. add short name (e.g. hub0, bot5) to /etc/hosts
            
            # bot1, hub5, etc.
            RELATED_ENTITY_SHORTNAME=${related_entity_type}${RELATED_ENTITY_ID}
            $SSH jaia@${ENTITY_IP} \
                 $RO_ROOT_CMD "bash -c \"grep -q ${RELATED_ENTITY_SHORTNAME} /etc/hosts || echo ${RELATED_ENTITY_IP_INTERNAL} ${RELATED_ENTITY_SHORTNAME} >> /etc/hosts\"; " \
                 $RO_CMD "bash -c \"ssh-keyscan -H ${RELATED_ENTITY_IP_INTERNAL} >> /home/jaia/.ssh/known_hosts 2> /dev/null \"; " \
                 $RO_CMD "bash -c \"ssh-keyscan -H ${RELATED_ENTITY_SHORTNAME} >> /home/jaia/.ssh/known_hosts 2> /dev/null \"; "
            echo "OK"

        done
    done
}

function ssh_key_setup() {
    # for all the hubs, create keys, and add them to the bots
    generate_and_exchange_keys "hub" "${HUB_IDS}" "bot" "${BOT_IDS}"

    # for all the bots, create keys, and add them to the hubs
    generate_and_exchange_keys "bot" "${BOT_IDS}" "hub" "${HUB_IDS}"
}

function fetch_wireguard_public_keys() {
    local entity_type=$1
    local entity_ids=$2

    for ENTITY_ID_QUOTED in ${entity_ids}
    do    
        ENTITY_ID=$(eval echo ${ENTITY_ID_QUOTED})
        ENTITY_IP=$(eval ${entity_type}_ip ${ENTITY_ID})

        echo "#################################################################"
        echo "========= FETCH WIREGUARD PUBLICKEY: ${entity_type^^} ${ENTITY_ID} =============="
        echo "#################################################################"

        ENTITY_WIREGUARD_PUBLIC_KEY=$($SSH jaia@${ENTITY_IP} sudo cat /etc/wireguard/publickey)

        cat <<EOF >> ${TMP_WIREGUARD_CONF}
[Peer]  
## ${entity_type^^} ${ENTITY_ID} ##
PublicKey = ${ENTITY_WIREGUARD_PUBLIC_KEY}
AllowedIPs = 172.23.${FLEET_ID}.$(eval ${entity_type}_id_to_last_ip_octet ${ENTITY_ID})/32

EOF
        echo "OK"
    done   
}

function wireguard_setup() {

    echo "#######################################################"
    echo "========= FETCH VPN.JAIA.TECH PRIVATEKEY =============="
    echo "#######################################################"

    SERVER_WIREGUARD_PRIVATE_KEY=$($SSH ubuntu@vpn.jaia.tech sudo cat /etc/wireguard/privatekey)   

    CONF=wg_fleet${FLEET_ID}.conf
    TMP_WIREGUARD_CONF=.tmp-${CONF}

    trap "rm -f ${TMP_WIREGUARD_CONF}" EXIT    
    cat <<EOF > ${TMP_WIREGUARD_CONF}
###########################
#### Fleet ${FLEET_ID} ####
###########################

[Interface]

# VPN Address for server
Address = 172.23.${FLEET_ID}.1/24

# VPN Server Port
ListenPort = $((51821 + ${FLEET_ID}))

# PrivateKey (contents of /etc/wireguard/privatekey)
PrivateKey = ${SERVER_WIREGUARD_PRIVATE_KEY}

# Note that this configuration uses NAT to make the VPN traffic appear to the rest of the Virtual Private Cloud (VPC) as if its coming from the VPN instance; this avoids the need for disabling the source/destination check or updating routing tables in EC2.
# update eth0 to the actual internet interface
PostUp = iptables -w 60 -A FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -w 60 -D FORWARD -i wg_fleet${FLEET_ID} -j ACCEPT; iptables -w 60 -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF
    
    # Fetch WireGuard public keys for all the hubs
    fetch_wireguard_public_keys "hub" "${HUB_IDS}"
    
    # Fetch WireGuard public keys for all the bots
    fetch_wireguard_public_keys "bot" "${BOT_IDS}"
    
    echo "###################################################################################"
    echo "========= PUSH AND ENABLE wg_fleet${FLEET_ID}.conf ON VPN.JAIA.TECH  =============="
    echo "###################################################################################"

    rsync -aP --rsh="$SSH" ${TMP_WIREGUARD_CONF} ubuntu@vpn.jaia.tech:/tmp/${TMP_WIREGUARD_CONF}
    SERVICE="wg-quick@wg_fleet${FLEET_ID}"
    $SSH ubuntu@vpn.jaia.tech "/bin/bash -c \"sudo mv /tmp/${TMP_WIREGUARD_CONF} /etc/wireguard/${CONF} && sudo systemctl enable ${SERVICE} && sudo systemctl restart ${SERVICE}\""
    
}

perform_action() {
    local action=$1
    local entity_type=$2
    local entity_ids=$3

    for ENTITY_ID_QUOTED in ${entity_ids}
    do    
        ENTITY_ID=$(eval echo ${ENTITY_ID_QUOTED})
        ENTITY_IP=$(eval ${entity_type}_ip ${ENTITY_ID})

        echo "#########################################################"
        echo "========= ${action^^}: ${entity_type^^} ${ENTITY_ID} =============="
        echo "#########################################################"

        case "${action}" in
            "disable_wireguard")
                SERVICE="wg-quick@wg_jaia"
                $SSH jaia@${ENTITY_IP} $RO_CMD "/bin/bash -c \"sudo systemctl disable ${SERVICE}\""
                ;;
            "setup_updates")
                UPDATE_SH="include/setup_updates.sh"
                $SSH jaia@${ENTITY_IP} $RO_CMD '/bin/bash -s' < ${UPDATE_SH} ${SETUP_UPDATES_MODE}
                ;;
            "xbee_radio_setup")
                if [[ -z "${JAIA_FLEET_CONFIG_XBEE_CFG:-}" ]]; then
                    echo "ERROR: you must set JAIA_FLEET_CONFIG_XBEE_CFG to the directory with fleet${FLEET_ID}/xbee.pb.cfg or directly to the xbee.pb.cfg file"
                    return 1
                fi

                FLEET_RADIO_CONFIG=${JAIA_FLEET_CONFIG_XBEE_CFG}
                if [[ ! -f "${FLEET_RADIO_CONFIG}" ]]; then
                    FLEET_RADIO_CONFIG=${JAIA_FLEET_CONFIG_XBEE_CFG}/fleet${FLEET_ID}/xbee.pb.cfg
                    if [[ ! -f "${FLEET_RADIO_CONFIG}" ]]; then
                        echo "Could not find XBee config file at ${JAIA_FLEET_CONFIG_XBEE_CFG} or ${FLEET_RADIO_CONFIG}. Please check value of ${JAIA_FLEET_CONFIG_XBEE_CFG}"
                        return 1
                    fi
                fi
               
                rsync --rsync-path="$RO_CMD rsync" ${FLEET_RADIO_CONFIG} jaia@${ENTITY_IP}:/etc/jaiabot
                ;;
            "create_ansible_inventory")
                ENTITY_IP_INTERNAL=$(eval ${entity_type}_ip ${ENTITY_ID} "internal")
                echo "    ${entity_type}${ENTITY_ID}-fleet${FLEET_ID}:" | tee -a ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}

                if [[ "$entity_type" = "hub" && "$CONFIGURE_VIRTUALBOX" != "true" ]]; then
                    # we do not currently have SSH keys set up for the hubs to connect to each other, so we use a local connection
                    # for the currently running hub to update itself. If we switch to having hubs on the same network, we can update
                    # the key exchange to do hub->hub exchange and then remove this (and using ansible_host, just as the bots do)
                    echo "      ansible_connection: local" | tee -a ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}
                else
                    echo "      ansible_host: ${ENTITY_IP_INTERNAL}" | tee -a ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}
                fi

		sed -i "s/${ENTITY_IP_INTERNAL}/${ENTITY_IP}/" ${ANSIBLE_VFLEET_INVENTORY} 
		
                ;;
            "copy_ansible_inventory")
                rsync --rsync-path="$RO_CMD rsync" --rsh="$SSH" ${ANSIBLE_INVENTORY} jaia@${ENTITY_IP}:/etc/jaiabot/inventory.yml
                ;;
            "reboot")
                $SSH -o ServerAliveInterval=2 jaia@${ENTITY_IP} "sudo systemctl start reboot.target" || true
                ;;
        esac
        echo "OK"
    done
}

function wireguard_disable() {
    perform_action "disable_wireguard" "hub" "${HUB_IDS}"
    perform_action "disable_wireguard" "bot" "${BOT_IDS}"    
}

function setup_updates() {
    SETUP_UPDATES_MODE="$1"
    perform_action "setup_updates" "hub" "${HUB_IDS}"
    perform_action "setup_updates" "bot" "${BOT_IDS}"
}

function xbee_radio_setup() {
    perform_action "xbee_radio_setup" "hub" "${HUB_IDS}"
    perform_action "xbee_radio_setup" "bot" "${BOT_IDS}"
}

function gen_ansible_inventory() {
    cat <<EOF | tee ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}
bots:
  hosts:
EOF
    perform_action "create_ansible_inventory" "bot" "${BOT_IDS}"
    cat <<EOF | tee -a ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}
hubs:
  hosts:
EOF
    [[ "$CONFIGURE_VIRTUALBOX" != "true" ]] && rm ${ANSIBLE_VFLEET_INVENTORY}
    perform_action "create_ansible_inventory" "hub" "${HUB_IDS}"

    # only need the inventory on the hubs, so only copy it there, to make configuring easier
    perform_action "copy_ansible_inventory" "hub" "${HUB_IDS}"
}

function reboot() {
    perform_action "reboot" "hub" "${HUB_IDS}"
    perform_action "reboot" "bot" "${BOT_IDS}"
}
