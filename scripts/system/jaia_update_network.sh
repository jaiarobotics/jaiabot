#!/bin/bash

set -a; source /etc/jaiabot/network.env; set +a

cat <<EOF > /etc/wpa_supplicant/wpa_supplicant-${jaia_network_wifi_iface}.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
  ssid="${jaia_network_fleet_ssid}"
  psk="${jaia_network_fleet_password}"
  id_str="fleet_wifi"
  priority=2 
}

network={
  ssid="${jaia_network_service_ssid}"
  psk="${jaia_network_service_password}"
  id_str="service_wifi"
  priority=1 
}

EOF

FLEET_SSID_LINE=""
# Omit SSID for VirtualBox fleet (really an eth interface in this case)
if [[ "${jaia_network_fleet_ssid}" != "" && "${jaia_network_fleet_ssid}" != "dummy" ]]; then
    FLEET_SSID_LINE="SSID=${jaia_network_fleet_ssid}"
fi
    cat <<EOF > /etc/systemd/network/10-${jaia_network_wifi_iface}-fleet.network
[Match]
Name=${jaia_network_wifi_iface}
${FLEET_SSID_LINE}

[Network]
Address=${jaia_network_fleet_address}
Gateway=${jaia_network_fleet_gateway}
DNS=1.1.1.1
DNS=8.8.8.8

EOF


cat <<EOF > /etc/systemd/network/20-${jaia_network_wifi_iface}-service.network
[Match]
Name=${jaia_network_wifi_iface}
SSID=${jaia_network_service_ssid}

[Network]
DHCP=yes
EOF

cat <<EOF > /etc/systemd/network/30-${jaia_network_eth_iface}.network
[Match]
Name=${jaia_network_eth_iface}

[Network]
DHCP=yes
EOF

if [[ "${jaia_network_eth_enabled}" = "false" ]]; then
    cat <<EOF >> /etc/systemd/network/30-${jaia_network_eth_iface}.network

[Link]
ActivationPolicy=manual
EOF
fi
