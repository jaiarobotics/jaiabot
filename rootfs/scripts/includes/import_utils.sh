function find_uuid()
{
    local VMNAME="$1"
    local GROUP="$2"
    for uuid in `vboxmanage list vms | grep "\"${VMNAME}\"" | sed 's/.*{\(.*\)}.*/\1/'`; do vboxmanage showvminfo --machinereadable $uuid | grep -q "groups=\"${GROUP}\"" && UUID="$uuid"; done
}

function find_diskuuid()
{
    local UUID="$1"
    DISKUUID=$(vboxmanage showvminfo --machinereadable "$UUID" | grep "SATA Controller-ImageUUID-0-0" | sed 's/"SATA Controller-ImageUUID-0-0"="\(.*\)"/\1/')
}

function write_preseed()
{
    local DISKUUID="$1"
    local N="$2"
    local BOT_OR_HUB="$3"
    
    ### mount disks
    ## BOOT
    local VBOX_MOUNT_PATH="/tmp/vbox-jaia/${DISKUUID}"
    mkdir -p "${VBOX_MOUNT_PATH}"
    vboximg-mount -i "${DISKUUID}" --rw --root "${VBOX_MOUNT_PATH}"
    sudo mount "${VBOX_MOUNT_PATH}/vol0" /mnt

    ssh_keys=$(cat $HOME/.ssh/*.pub)
    
    cat <<EOF | sudo tee /mnt/jaiabot/init/first-boot.preseed
# Preseed configuration. Booleans can be "true" or "yes"
# This is a bash script so any bash command is allowed
# Edit and rename to "/boot/firmware/jaiabot/init/first-boot.preseed" to take effect

jaia_run_first_boot=true
jaia_stress_tests=false

########################################################
# Network
########################################################
jaia_disable_ethernet=true
jaia_configure_wifi=true
jaia_wifi_ssid=dummy
jaia_wifi_password=dummy

########################################################
# SSH temp keys (to allow first boot to be run)
########################################################
jaia_do_add_authorized_keys=true
jaia_authorized_keys=$(cat << EOM
${ssh_keys}
EOM
)

#########################################################
# Preseed jaiabot-embedded package debconf queries
# See jaiabot-embedded.templates from jaiabot-debian 
# https://github.com/jaiarobotics/jaiabot-debian/blob/1.y/jaiabot-embedded.templates
# To dump config in the correct format on a bot that is configured use: "debconf-get-selections  | grep jaia"
#########################################################
jaia_install_jaiabot_embedded=true
jaia_embedded_debconf=\$(cat << EOM
jaiabot-embedded	jaiabot-embedded/fleet_id	select	${FLEET}
jaiabot-embedded	jaiabot-embedded/type	select	${BOT_OR_HUB}
jaiabot-embedded	jaiabot-embedded/mode	select	simulation
jaiabot-embedded	jaiabot-embedded/warp	select	10
jaiabot-embedded	jaiabot-embedded/bot_id	select	${N}
jaiabot-embedded	jaiabot-embedded/hub_id	select	${N}
jaiabot-embedded	jaiabot-embedded/arduino_type	select	none
jaiabot-embedded	jaiabot-embedded/electronics_stack	select	2
jaiabot-embedded	jaiabot-embedded/led_type	select	none
EOM
)

jaia_reboot=true
EOF

    sudo umount /mnt
    
    sudo umount -l "${VBOX_MOUNT_PATH}"
}
