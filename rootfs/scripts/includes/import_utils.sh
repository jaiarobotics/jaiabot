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
 
    tmp_boot="/tmp/import_vms"
    mkdir -p ${tmp_boot}/jaiabot/init
    cp /mnt/jaiabot/init/* ${tmp_boot}/jaiabot/init
    jaia admin fleet generate /tmp/fleet.cfg --mode simulation ${BOT_OR_HUB} ${N} --bootdir ${tmp_boot}
    sudo cp ${tmp_boot}/jaiabot/init/* /mnt/jaiabot/init/
    
    sudo umount /mnt

    ## ROOTFS
    # set up grub to use nocloud and preseed
    sudo mount "${VBOX_MOUNT_PATH}/vol1" /mnt
    sudo chroot /mnt sed -i 's|\(GRUB_CMDLINE_LINUX_DEFAULT=".*\)"|\1 ds=nocloud\\;s=file:///etc/jaiabot/init/ network-config=disabled"|' /etc/default/grub
    sudo mount -o bind /dev /mnt/dev
    sudo mount -o bind /proc /mnt/proc
    sudo chroot /mnt update-grub
    
    sudo umount /mnt/dev
    sudo umount /mnt/proc
    sudo umount /mnt    
    
    sudo umount -l "${VBOX_MOUNT_PATH}"
}


function create_hub_ssh_key()
{
    local N="$1"
    rm -f ${HUB_KEY_DIR}/hub${N}_fleet${FLEET}*
    ssh-keygen -t ed25519 -f ${HUB_KEY_DIR}/hub${N}_fleet${FLEET} -N "" -C "hub${N}_fleet${FLEET}"
}
