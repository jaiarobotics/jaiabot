ANSIBLE_INVENTORY=/tmp/jaiabot-ansible-inventory.yml

# used by cloud/create-virtualfleet.yml ansible playbook
ANSIBLE_VFLEET_INVENTORY=/tmp/jaiabot-ansible-vfleet-inventory.yml

function retrofit_ssh() {
    echo "#################################################################"
    echo "========= fleet/retrofit-ssh-config.yml =============="
    echo "#################################################################"
    ansible-playbook ${ansible_dir}/fleet/retrofit-ssh-config.yml -i ${INVENTORY} -e CONFIGURE_VIRTUALFLEET=${CONFIGURE_VIRTUALFLEET}
}

function ssh_key_setup() {
    echo "#################################################################"
    echo "========= fleet/ssh-create-hub-keys.yml =============="
    echo "#################################################################"
    ansible-playbook ${ansible_dir}/fleet/ssh-create-hub-keys.yml -i ${INVENTORY} -e CONFIGURE_VIRTUALFLEET=${CONFIGURE_VIRTUALFLEET} -e JAIA_FLEET_CONFIG_YUBIKEYS_DIR=${JAIA_FLEET_CONFIG_YUBIKEYS_DIR:-}
    echo "#################################################################"
    echo "========= fleet/ssh-copy-hub-keys.yml =============="
    echo "#################################################################"
    ansible-playbook ${ansible_dir}/fleet/ssh-copy-hub-keys.yml -i ${INVENTORY} -e CONFIGURE_VIRTUALFLEET=${CONFIGURE_VIRTUALFLEET} -e JAIA_FLEET_CONFIG_YUBIKEYS_DIR=${JAIA_FLEET_CONFIG_YUBIKEYS_DIR:-} -e HUB_IS_PRESENT=True
    echo "#################################################################"
    echo "========= fleet/ssh-update-hubs.yml =============="
    echo "#################################################################"
    ansible-playbook ${ansible_dir}/fleet/ssh-update-hubs.yml -i ${INVENTORY} -e CONFIGURE_VIRTUALFLEET=${CONFIGURE_VIRTUALFLEET}
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

                if [[ "$entity_type" = "hub" ]]; then
                    # we do not currently have SSH keys set up for the hubs to connect to each other, so we use a local connection
                    # for the currently running hub to update itself. If we switch to having hubs on the same network, we can update
                    # the key exchange to do hub->hub exchange and then remove this (and using ansible_host, just as the bots do)
                    echo "      ansible_connection: local" | tee -a ${ANSIBLE_INVENTORY}
                    echo " ansible_host: ${ENTITY_IP_INTERNAL}" | tee -a ${ANSIBLE_VFLEET_INVENTORY}
                else
                    echo "      ansible_host: ${ENTITY_IP_INTERNAL}" | tee -a ${ANSIBLE_INVENTORY} ${ANSIBLE_VFLEET_INVENTORY}
                fi

                sed -i "s/${ENTITY_IP_INTERNAL}/${ENTITY_IP}/" ${ANSIBLE_VFLEET_INVENTORY}
                
                ;;
            "copy_ansible_inventory")
                rsync --rsync-path="$RO_CMD rsync" --rsh="$SSH" ${ANSIBLE_INVENTORY} jaia@${ENTITY_IP}:/etc/jaiabot/inventory.yml
                ;;
        esac
        echo "OK"
    done
}

function wireguard_disable() {
    perform_action "disable_wireguard" "hub" "${HUB_IDS}"
    perform_action "disable_wireguard" "bot" "${BOT_IDS}"    
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
    [[ "$CONFIGURE_VIRTUALFLEET" != "true" ]] && rm ${ANSIBLE_VFLEET_INVENTORY}
    perform_action "create_ansible_inventory" "hub" "${HUB_IDS}"

    # only need the inventory on the hubs, so only copy it there, to make configuring easier
    perform_action "copy_ansible_inventory" "hub" "${HUB_IDS}"
}

function reboot() {
    ansible-playbook ${ansible_dir}/reboot-all.yml -i ${INVENTORY}
}
