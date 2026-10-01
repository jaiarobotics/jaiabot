#!/bin/bash

echo "Network $1 changed at $(date): $2"

if [[ "$2" != "CONNECTED" ]]
  then exit
fi


if [ "$EUID" -ne 0 ]
  then echo "Must be root to run this script"
  exit
fi

source /usr/bin/jaia-debconf.sh
CLOUDHUB_VPN_IFACE=wg_jaia_ch$(jaia_debconf_get fleet_id)

# Find the id_str in wpa_supplicant.conf
WIFI_ID_STR=$(wpa_cli -i wlan0 status | grep "^id_str=" | cut -d= -f2)

echo "id_str: $WIFI_ID_STR"

# Define UFW rules for each SSID
function apply_ufw_rules_for_fleet_wifi {
    ufw --force reset 
    ufw default allow incoming
    ufw default allow outgoing
    ufw --force enable
} 

function apply_ufw_rules_for_service_wifi {
    ufw --force reset 
    ufw default deny incoming
    ufw default allow outgoing
    # No inbound rule for the VPN server: this node is the client, and ufw accepts the
    # established conntrack entry the handshake opens. PersistentKeepalive holds it open.
    ufw allow in on ${CLOUDHUB_VPN_IFACE}
    ufw allow out on ${CLOUDHUB_VPN_IFACE}
    ufw --force enable 
}

# Apply UFW rules based on the current SSID
case "$WIFI_ID_STR" in
    "fleet_wifi")
        apply_ufw_rules_for_fleet_wifi
        ;;
    "service_wifi")
        apply_ufw_rules_for_service_wifi
        ;;
    *)
        # use restrictive rules for any other network 
        apply_ufw_rules_for_service_wifi
        ;;
esac

