#!/bin/bash

echo "Network $1 changed at $(date): $2"

if [[ "$2" != "CONNECTED" ]]
  then exit
fi


if [ "$EUID" -ne 0 ]
  then echo "Must be root to run this script"
  exit
fi

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
    # vpn.jaia.tech
    ufw allow in from 52.36.157.57 proto udp
    ufw allow in on wg_jaia
    ufw allow out on wg_jaia
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

