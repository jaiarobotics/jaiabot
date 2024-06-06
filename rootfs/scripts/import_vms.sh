#!/bin/bash

# Simple script to import N copies of a jaiabot OVA to VirtualBox

#set -x
set -u -e

source includes/import_utils.sh

if [ ! $# -eq 4 ]; then
   echo "Usage ./import_vms.sh vm.ova n_bots n_hubs fleet_id"
   exit 1;
fi

OVA="$1"
N_BOTS="$2"
N_HUBS="$3"
FLEET="$4"

OVA_BASENAME=$(basename $OVA)
OVA_EXTENSION="${OVA_BASENAME##*.}"
GROUP="/${OVA_BASENAME%.*}"

GROUP=$(echo "$GROUP" | sed 's/[\+~\.]/_/g')

if vboxmanage list groups | grep -q "\"${GROUP}\""; then
    echo "Group \"${GROUP}\" already exists. Please delete all VMs from this group before re-importing"
    exit 1;
fi

if [[ "${OVA_EXTENSION}" != "ova" ]]; then
    echo "Expecting .ova for first argument, got $OVA"
    exit 1;
fi

N_CPUS=4

HOST_SSH_PORT=$((20000 + ${FLEET}*100))

NATNET_NAME=$(printf 'jaiafleet%02d' ${FLEET})
vboxmanage list natnets | grep -q ${NATNET_NAME} && vboxmanage natnetwork remove --netname ${NATNET_NAME}
vboxmanage natnetwork add --netname ${NATNET_NAME} --network 10.23.${FLEET}.0/24 --enable --dhcp off    

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

    [[ "$bot_or_hub" == "bot" ]] && GUEST_SSH_PORT=$((100+n)) || GUEST_SSH_PORT=$((10+n))
    
    vboxmanage natnetwork modify --netname ${NATNET_NAME} --port-forward-4="ssh ${VMNAME}:tcp:[]:${HOST_SSH_PORT}:[10.23.${FLEET}.${GUEST_SSH_PORT}]:22"

    SSH_CONFIG+="Host ${VMNAME}-virtualfleet${FLEET}\n  User jaia\n  Port ${HOST_SSH_PORT}\n  HostName 127.0.0.1\n"
    
    HOST_SSH_PORT=$((HOST_SSH_PORT + 1))    
}

for n in `seq 1 $((N_BOTS))`; do
    import_bot_or_hub bot $n
done

for n in `seq 1 $((N_HUBS))`; do
    import_bot_or_hub hub $n
done

echo -e "Add to .ssh/config if desired:\n${SSH_CONFIG}"
