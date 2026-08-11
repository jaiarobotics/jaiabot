# Major software upgrade

A major software upgrade is defined as updating the Ubuntu release as well as the Jaiabot software release. This is typically done from major Jaiabot versions (e.g., v1 -> v2). It can also be done when a major version spans support for multiple Ubuntu releases (e.g. v1 on Ubuntu "focal" to v1 on Ubuntu "jammy").

## Preparing for major upgrade

### Ensure the Hub has a valid Fleet Configuration

If this fleet was generated prior to fleet configuration files (this includes most 1.y fleets), one will need to be created for the current fleet. This can be done using `jaia admin fleet create` as described in the [Embedded Board Deployment](page025_embedded_setup.md) document.

This fleet configuration must then be embedded in the upgrade image (see the next step).

If the fleet was generated using a fleet configuration file, a valid file on the hub should already exist at `/etc/jaiabot/fleetN.cfg`. In this case that fleet configuration will be reused and no further action is required.


### Download and flash the upgrade image

Download the desired release CD image (e.g. jaiabot_updates_resolute_3.0.0_arm64.iso).

If you need to embed the fleet configuration (see previous section), do so now with:

```
jaia admin fleet update_iso /path/to/fleetN.cfg /path/to/jaiabot_updates_resolute_3.0.0_arm64.iso
```

This will embed the fleet config (at `major_upgrades/fleetN.cfg` within the ISO). and write a new ISO called `/path/to/jaiabot_updates_resolute_3.0.0_arm64_fleetN.iso`.

Now, write the ISO to a  USB flash drive (or burn it to a CD-R disc):

Assuming the USB flash drive is /dev/sdb:
```
# for fleets WITHOUT previous fleet config (most 1.y fleets)
ISO=jaiabot_updates_resolute_3.0.0_arm64_fleetN.iso
# OR for fleets WITH previous fleet config
ISO=jaiabot_updates_resolute_3.0.0_arm64.iso

sudo dd if=$ISO of=/dev/sdb bs=1M status=progress
```

Insert the flash drive into the fleet Hub or attach a USB CD drive with the CD inserted, then boot or reboot the Hub to mount it.

## Running the major upgrade

Use Ansible to run the major upgrade, either on the command line or via the JCU UI.

```
# in /usr/share or local git clone
cd jaiabot/config/ansible/major_upgrade
ansible-playbook -i /etc/jaiabot/inventory.yml major-upgrade.yml -e hub_id=1 -e do_backup=yes
```

where `hub_id` is the hub in use (the one with the upgrade USB flash key or CD connected) and `do_backup` is a boolean set to whether the existing (old) rootfs and overlay should be backed up to the `/var/log/jaiabot/major_upgrade/vX_codename` directory prior to the upgrade.

To upgrade multiple Hubs, you will need to re-run this command (with the update hub_id) after moving the USB flash key to the new hub. Any number of bots will be updated from a single Hub as part of this command.

## Major upgrade design

The major upgrade extracts a new filesystem image and configures it, much like a generating a new bot or hub as described in the [Embedded Board Deployment](page025_embedded_setup.md) document. This means that the state of the previous installation filesystem is largely irrelevant.

The first part of the upgrade is handled by Ansible and the second part is handled by a shell script on each machine.

After the upgrade, the rootfs and overlay partitions are swapped, and the boot partition is overwritten. The data (log) partition is unmodified: 

- Before: 
  - /dev/sdX1: [boot (v1)] (fat32)
  - /dev/sdX2: **[rootfs (v1)]** (ext4 or btrfs)
  - /dev/sdX3: *[overlay (v1)]* (btrfs)
  - /dev/sdX4: [data] (btrfs)
- After:
  - /dev/sdX1: [boot (v2)] (fat32)
  - /dev/sdX2: *[overlay (v2)]* (btrfs)
  - /dev/sdX3: **[rootfs (v2)]** (btrfs)
  - /dev/sdX4: [data] (btrfs)

This is necessary to allow the running rootfs to bootstrap the new image. This works because both partitions are the same size (8GB) and all references use the filesystem label not the partition ID. Old systems that use ext4 for the rootfs change this to use btrfs going forward. 

### Ansible steps

See major-upgrade.yml for full details on the steps performed.

The playbook ensures that the new Ubuntu version is newer than the existing version and new Jaiabot version is not older than the existing version, to prevent meaningless double-upgrades or accidental major upgrades that should be normal upgrades (e.g. 1.16.0->1.17.0).

The upgrade is staged in `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}` where {X} is the major version to be updated to and {ubuntucode} is the new Ubuntu version. For example: `/var/log/jaiabot/major_upgrade/v3_resolute`.

The new upgrade image for the rootfs and bootfs are downloaded from the Hub into the staging directory.

A backup of the old rootfs and overlayfs is copied and compressed to `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}/backup/rootfs.tar.gz and overlay.tar.gz`, respectively, as the major upgrade will clear both the old rootfs and overlayfs.

The Wireguard files are copied into the staging directory to be reused to avoid having to reconfigure the service VPN on the new image.

The new boot filesystem is prepared using `jaia admin fleet generate` using the fleet configuration file. The VPN keys (id_vpn_tmp) are removed to avoid regenerated the service VPN.

Finally the `do-major-upgrade.sh` is configured to `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}` and run.

### Scripted steps

`do-major-upgrade.sh` finalizes the upgrade:
- pivot the root filesystem from the normal overlayfs onto just the normally read-only rootfs partition. This frees up the "overlay" partition to use as the new rootfs.
- extract new rootfs onto old overlay partition
- restore reused files (Wireguard config)
- write new boot filesystem
- swap labels for rootfs/overlay
- reboot into new filesystem (which runs first-boot cloud-init to finish configuration of new system).

This script logs to `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}/major_upgrade_final.log`
