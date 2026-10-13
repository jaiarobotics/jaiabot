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
    local VBOX_MOUNT_PATH="${tmp_dir}/vbox-jaia/${DISKUUID}"
    mkdir -p "${VBOX_MOUNT_PATH}"
    vboximg-mount -i "${DISKUUID}" --rw --root "${VBOX_MOUNT_PATH}"
    sudo mount "${VBOX_MOUNT_PATH}/vol0" /mnt
 
    tmp_boot="${tmp_dir}/import_vms"
    rm -rf ${tmp_boot}
    mkdir -p ${tmp_boot}/jaiabot/init
    cp -r /mnt/jaiabot/init/* ${tmp_boot}/jaiabot/init
    jaia admin fleet generate ${tmp_dir}/fleet.cfg --mode simulation ${BOT_OR_HUB} ${N} --bootdir ${tmp_boot}
    sudo cp -r ${tmp_boot}/jaiabot/init/* /mnt/jaiabot/init/
    
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

    # vboximg-mount holds the disk's write lock until it exits, and a lazy unmount
    # returns before that; a VM started meanwhile boots from a half-written disk
    sudo umount "${VBOX_MOUNT_PATH}" || sudo umount -l "${VBOX_MOUNT_PATH}"
    for i in $(seq 1 60); do
        pgrep -f "vboximg-mount -i ${DISKUUID}" > /dev/null || break
        sleep 1
    done
    if pgrep -f "vboximg-mount -i ${DISKUUID}" > /dev/null; then
        echo "WARNING: vboximg-mount is still holding disk ${DISKUUID}"
    fi
}


function create_hub_ssh_key()
{
    local N="$1"
    rm -f ${HUB_KEY_DIR}/hub${N}_fleet${FLEET}*
    ssh-keygen -t ed25519 -f ${HUB_KEY_DIR}/hub${N}_fleet${FLEET} -N "" -C "hub${N}_fleet${FLEET}"
}
