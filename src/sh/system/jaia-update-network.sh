#!/bin/bash

set -a; source /etc/jaiabot/network.env; set +a

# Write stdin to $1 through a temporary file and a rename, so a power loss leaves either the old
# file or the new one, never a partial one.
write_atomic() {
    local dest="$1"
    local tmp
    tmp=$(mktemp "${dest}.XXXXXX") || { echo "Cannot write ${dest}" >&2; return 1; }
    if cat > "${tmp}" &&
        if [[ -e "${dest}" ]]; then chmod --reference="${dest}" "${tmp}"; else chmod 644 "${tmp}"; fi &&
        sync "${tmp}" &&
        mv -f "${tmp}" "${dest}"; then
        sync "$(dirname "${dest}")"
    else
        rm -f "${tmp}"
        echo "Failed to write ${dest}; left the previous version in place" >&2
        return 1
    fi
}

status=0

write_atomic /etc/wpa_supplicant/wpa_supplicant-${jaia_network_wifi_iface}.conf <<EOF || status=1
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
  ssid="${jaia_network_fleet_ssid}"
  psk="${jaia_network_fleet_password}"
  id_str="fleet_wifi"
}

EOF

FLEET_SSID_LINE=""
# Omit SSID for VirtualBox fleet (really an eth interface in this case)
if [[ "${jaia_network_fleet_password}" != "dummy" ]]; then
    FLEET_SSID_LINE="SSID=${jaia_network_fleet_ssid}"
fi

{
    cat <<EOF
[Match]
Name=${jaia_network_wifi_iface}
${FLEET_SSID_LINE}

[Network]
Address=${jaia_network_fleet_address}
EOF

    # An IPv6 fleet has no IPv4 address of its own, so it takes one from the access point for
    # internet access only; nothing in the fleet is addressed by it. An IPv4 fleet routes through
    # the access point statically, as it always has.
    if [[ "${jaia_network_fleet_dhcp:-}" != "" ]]; then
        echo "DHCP=${jaia_network_fleet_dhcp}"
    fi

    if [[ "${jaia_network_fleet_gateway}" != "" ]]; then
        echo "Gateway=${jaia_network_fleet_gateway}"
    fi

    cat <<EOF
DNS=1.1.1.1
DNS=8.8.8.8

EOF
} | write_atomic /etc/systemd/network/10-${jaia_network_wifi_iface}-fleet.network || status=1

{
    if [[ "${jaia_network_eth_address}" != "" ]]; then
        cat <<EOF
[Match]
Name=${jaia_network_eth_iface}

[Network]
Address=${jaia_network_eth_address}
EOF
    else
        cat <<EOF
[Match]
Name=${jaia_network_eth_iface}

[Network]
DHCP=yes
EOF
    fi

    if [[ "${jaia_network_eth_enabled}" = "false" ]]; then
        cat <<EOF

[Link]
ActivationPolicy=manual
EOF
    fi
} | write_atomic /etc/systemd/network/30-${jaia_network_eth_iface}.network || status=1

exit ${status}
