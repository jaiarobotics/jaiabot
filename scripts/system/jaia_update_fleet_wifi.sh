#!/bin/bash

fleet_ssid=$1
fleet_password=$2
iface=wlan0

service_ssid="JaiaService"
service_password="jaia_service"

systemd_networkd_file="/etc/systemd/network/10-wlan0-fleet.network"

cat <<EOF > /etc/wpa_supplicant/wpa_supplicant-${iface}.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
  ssid="${fleet_ssid}"
  psk="${fleet_password}"
  id_str="fleet_wifi"
  priority=2 
}

network={
  ssid="${service_ssid}"
  psk="${service_password}"
  id_str="service_wifi"
  priority=1 
}

EOF
