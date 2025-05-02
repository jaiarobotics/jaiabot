#!/bin/bash

set -u -e

# expects 'create-ansible-inventory.sh -b 1,2,3 -h 1,2' where -b is the comma separated list of bot IDs, and -h is the comma separated list of hub IDs
# optionally takes '-f N' for fleet ID N, otherwise the fleet ID is read from debconf for jaiabot-embedded
# also optionally takes -n for net (Defaults to 'wlan')

bots=""
hubs=""
fleet=""
net="wlan"

# Parse command line arguments
while getopts "b:h:f:n:" opt; do
    case $opt in
        b)
            bots=$OPTARG
            ;;
        h)
            hubs=$OPTARG
            ;;
        f)
            fleet=$OPTARG
            ;;
        n)
            net=$OPTARG
            ;;
        *)
            echo "Invalid option: -$OPTARG" >&2
            exit 1
            ;;
    esac
done

if [ "$net" = "wlan" ]; then
    ipv="4"
else
    ipv="6"
fi

if [ "$fleet" = "" ]; then
    fleet=$(debconf-get-selections | grep jaiabot-embedded/fleet_id | cut -f 4)
fi

if [ "$fleet" = "" ]; then
    echo "Failed to obtain fleet value - use '-f' or set debconf jaiabot-embedded/fleet_id"
    exit 1
fi

# Convert comma-separated values into arrays
bots_array=($(echo "$bots" | tr ',' ' '))
hubs_array=($(echo "$hubs" | tr ',' ' '))

echo "bots:"
echo "  hosts:"
for b in "${bots_array[@]}"; do
    ip=$(eval jaia-ip.py --node bot --net ${net} --fleet_id ${fleet} --node_id ${b} addr --ipv${ipv})
    echo "    bot${b}-fleet${fleet}:"
    echo "      ansible_user: jaia"
    echo "      ansible_host: ${ip}"
done

echo "hubs:"
echo "  hosts:"
for h in "${hubs_array[@]}"; do
    ip=$(eval jaia-ip.py --node hub --net ${net} --fleet_id ${fleet} --node_id ${h} addr --ipv${ipv})
    echo "    hub${h}-fleet${fleet}:"
    echo "      ansible_user: jaia"
    echo "      ansible_host: ${ip}"
done
