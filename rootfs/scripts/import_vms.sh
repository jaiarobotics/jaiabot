#!/bin/bash

# Simple script to import N copies of a jaiabot OVA to VirtualBox

#set -x
set -u -e

tmp_dir=$(mktemp -d)

echo "Using tmp_dir: ${tmp_dir}"
#trap "rm -rf $tmp_dir" EXIT

source includes/import_utils.sh

if [ ! $# -eq 4 ]; then
   echo "Usage ./import_vms.sh vm.ova n_bots|bots_comma_separated_list n_hubs|hubs_comma_separated_list fleet_id"
   exit 1;
fi

# prompt for sudo up front
sudo bash -c "exit"

OVA="$1"
BOTS_PARAM="$2"
HUBS_PARAM="$3"
FLEET="$4"

if echo "${BOTS_PARAM}" | grep -q ","; then
    IFS=',' read -r -a BOTS <<< "$BOTS_PARAM"
else
    BOTS=($(seq 1 ${BOTS_PARAM}))
fi

if echo "${HUBS_PARAM}" | grep -q ","; then
    IFS=',' read -r -a HUBS <<< "$HUBS_PARAM"
else
    HUBS=($(seq 1 ${HUBS_PARAM}))    
fi

OVA_BASENAME=$(basename $OVA)
OVA_EXTENSION="${OVA_BASENAME##*.}"
GROUP="/${OVA_BASENAME%.*}"

GROUP=$(echo "$GROUP" | sed 's/[\+~\.]/_/g')

for n in "${BOTS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    if VBoxManage list vms -l | awk -v RS= "/Groups:.*\\${GROUP}/" | grep '^Name:' | grep -q bot$n; then
        echo "bot${n} in group \"${GROUP}\" already exists. Please delete this VM from this group before re-importing"
        exit 1;
    fi
done

for n in "${HUBS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    if VBoxManage list vms -l | awk -v RS= "/Groups:.*\\${GROUP}/" | grep '^Name:' | grep -q hub$n; then
        echo "hub${n} in group \"${GROUP}\" already exists. Please delete this VM from this group before re-importing"
        exit 1;
    fi
done

if [[ "${OVA_EXTENSION}" != "ova" ]]; then
    echo "Expecting .ova for first argument, got $OVA"
    exit 1;
fi

N_CPUS=4

# the fleet's addresses come from the addressing scheme rather than being rebuilt here
if ! command -v jaia_ip > /dev/null; then
    echo "This script needs the 'jaia_ip' tool to work out the fleet's addresses."
    echo "Install the jaiabot-embedded package, or build it from src/bin/jaia_ip."
    exit 1
fi

HOST_SSH_PORT=$((20000 + ${FLEET}*100))

# these ports are forwarded on this machine, so a fleet id big enough to push its block past the
# end of the port range cannot be imported here whatever the addressing scheme allows
MAX_PORT=65535
if (( HOST_SSH_PORT + ${#BOTS[@]} + ${#HUBS[@]} > MAX_PORT )); then
    echo "Fleet ${FLEET} would forward host ports from ${HOST_SSH_PORT}, past the end of the port range."
    echo "A VirtualBox fleet takes one host port per node from 20000 + fleet_id*100, so its fleet id"
    echo "must be below $(( (MAX_PORT - 20000) / 100 )) on this machine. Import it under a smaller fleet id."
    exit 1
fi

NATNET_NAME=$(printf 'jaiafleet%02d' ${FLEET})

# The guests take their addresses from the jaiabot image, which uses the fleet WLAN scheme, so the
# NAT network has to hand out the same ones. Above the IPv4 fleet range that scheme is IPv6, and
# the guests then take IPv4 from this network's DHCP for internet access only, matching how a real
# fleet of that id is set up. VirtualBox needs an IPv4 network either way; --ip_net vfleet_wlan is
# the one the addressing scheme sets aside for a virtual fleet that cannot mirror its fleet's WLAN.
FLEET_WLAN_NET=$(jaia_ip --query_type net --ip_net wlan --fleet_id ${FLEET})
NATNET_IPV4=$(jaia_ip --query_type net --ip_net vfleet_wlan --fleet_id ${FLEET} --ip_version ipv4)

vboxmanage list natnets | grep -q ${NATNET_NAME} && vboxmanage natnetwork remove --netname ${NATNET_NAME}

if [[ "${FLEET_WLAN_NET}" == *:* ]]; then
    # --ipv6-prefix is missing from 'VBoxManage natnetwork --help' but is accepted and applied
    # (checked against 7.0.16, which rejects an option it does not know)
    vboxmanage natnetwork add --netname ${NATNET_NAME} --network ${NATNET_IPV4} --enable --dhcp on \
                              --ipv6 on --ipv6-prefix ${FLEET_WLAN_NET}
else
    vboxmanage natnetwork add --netname ${NATNET_NAME} --network ${NATNET_IPV4} --enable --dhcp off
fi

function import_bot_or_hub()
{
    local bot_or_hub=$1
    local n=$2

    echo "####### IMPORTING $bot_or_hub $n ################"
    VMNAME="${bot_or_hub}${n}"
    vboxmanage import "$OVA" --options=importtovdi --vsys 0 --vmname "$VMNAME" --cpus ${N_CPUS} --group "$GROUP"
    find_uuid $VMNAME $GROUP
    echo "Imported UUID: $UUID"
    find_diskuuid $UUID
    VBoxManage modifyvm $UUID --nic2 natnetwork --nat-network2 "${NATNET_NAME}"

    echo "Disk UUID: $DISKUUID"
    write_preseed $DISKUUID $n ${bot_or_hub}

}

function network_bot_or_hub()
{
    local bot_or_hub=$1
    local n=$2
    VMNAME="${bot_or_hub}${n}"
    GUEST_IP=$(jaia_ip --query_type addr --node_type ${bot_or_hub} --node_id ${n} --ip_net wlan --fleet_id ${FLEET})
    (set -x
     if [[ "${GUEST_IP}" == *:* ]]; then
         vboxmanage natnetwork modify --netname ${NATNET_NAME} --port-forward-6="ssh ${VMNAME}:tcp:[]:${HOST_SSH_PORT}:[${GUEST_IP}]:22"
     else
         vboxmanage natnetwork modify --netname ${NATNET_NAME} --port-forward-4="ssh ${VMNAME}:tcp:[]:${HOST_SSH_PORT}:[${GUEST_IP}]:22"
     fi
    )
    SSH_CONFIG+="Host ${VMNAME}-virtualfleet${FLEET}\n  User jaia\n  Port ${HOST_SSH_PORT}\n  HostName 127.0.0.1\n"
    HOST_SSH_PORT=$((HOST_SSH_PORT + 1))
}


HUB_KEY_DIR=${tmp_dir}/jaia_vm_hub_keys
mkdir -p ${HUB_KEY_DIR}

perm_ssh_keys=$(cat $HOME/.ssh/*.pub | sed 's/^/permanent_authorized_keys: "/' | sed 's/$/"/')

# Get all the existing bots / hubs in this fleet
EXISTING_BOTS=()
EXISTING_HUBS=()
while read -r _ name; do
    if [[ $name == bot* ]]; then
        EXISTING_BOTS+=("${name#bot}")
    elif [[ $name == hub* ]]; then
        EXISTING_HUBS+=("${name#hub}")
    fi
done <<< "$(VBoxManage list vms -l | awk -v RS= "/Groups:.*\\${GROUP}/" | grep '^Name:')"

ALL_BOTS=(${BOTS[@]} ${EXISTING_BOTS[@]})
ALL_HUBS=(${HUBS[@]} ${EXISTING_HUBS[@]})

cat <<EOF > ${tmp_dir}/fleet.cfg
fleet: ${FLEET}
hubs: [$(IFS=,; echo "${ALL_HUBS[*]}")]
bots: [$(IFS=,; echo "${ALL_BOTS[*]}")]
ssh {
${perm_ssh_keys}
$(for HUB in "${HUBS[@]}"; do
     if [ -z "$HUB" ]; then continue; fi

    KEYNAME="hub${HUB}_fleet${FLEET}"
    PRIVKEY="${HUB_KEY_DIR}/${KEYNAME}"
    PUBKEY="${PRIVKEY}.pub"
    rm -f $PRIVKEY $PUBKEY
    ssh-keygen -f $PRIVKEY -t ed25519 -N "" -C "$KEYNAME" >& /dev/null
    PRIVKEY_CONTENTS=$(awk '{print "\"" $0 "\\n\""}' ${PRIVKEY})    
    PUBKEY_CONTENTS="\"$(cat ${PUBKEY})\""
    echo "  hub { id: ${HUB} private_key: ${PRIVKEY_CONTENTS} public_key: ${PUBKEY_CONTENTS} }"
done)
}
wlan_password: "dummy"
service_vpn_enabled: false

debconf {
  key: "jaiabot-embedded/mode"
  type: SELECT
  value: "simulation"
}
debconf {
  key: "jaiabot-embedded/warp"
  type: SELECT
  value: "10"
}
debconf {
  key: "jaiabot-embedded/user_role"
  type: SELECT
  value: "developer"
}
debconf {
  key: "jaiabot-embedded/comms_links"
  type: MULTISELECT
  value: "wifi"
}

EOF

for n in "${BOTS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    import_bot_or_hub bot $n
done

for n in "${HUBS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    import_bot_or_hub hub $n
done

for n in "${ALL_BOTS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    network_bot_or_hub bot $n
done

for n in "${ALL_HUBS[@]}"; do
    if [ -z "$n" ]; then continue; fi
    network_bot_or_hub hub $n
done

rm -rf ${HUB_KEY_DIR}

echo -e "Add to .ssh/config if desired:\n${SSH_CONFIG}"
