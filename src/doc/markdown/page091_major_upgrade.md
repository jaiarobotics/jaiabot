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

## Fleet configuration versioning

The fleet configuration is written once when a fleet is created and read again at every major upgrade, possibly years later by a newer release (see the Ansible steps above). This section describes how changes to what a fleet config must contain are tracked, so that a major upgrade can either migrate an older file automatically or fail early with a clear message rather than silently produce a misconfigured system.

### The contract

What a fleet config must conform to is more than `fleet_config.proto`: the debconf answers it carries (`debconf { key: "jaiabot-embedded/bot_type" value: "pam" }`) are opaque strings to protobuf, so `debian/jaiabot-embedded.templates` is part of the contract too. The contract is:

- every message, field (name, number, label, type, default, deprecation) and enum value reachable from `FleetConfig`, and
- every `jaiabot-embedded/*` debconf question (type, choices, default), except the `debconf_state_*` menu bookkeeping.

`scripts/build/fleet-config-contract.py generate` produces it as normalised JSON. One snapshot per contract version is committed under `src/lib/messages/fleet_config/contract/vN.json`, and `PROJECT_FLEET_CONFIG_VERSION` in `cmake/JaiaVersions.cmake` names the current one. Fleet configs carry the version they were written for in the `version` field; files that predate the field are version 1 (this includes every file created before the 3.y release).

The build also writes the current contract to `share/jaiabot/fleet_config/contract.json`, together with `fleet_config.desc` (a protobuf `FileDescriptorSet`), for tools that need to parse and validate fleet configs without the generated bindings.

### The build-time check

Building `jaiabot_messages` regenerates the contract and compares it with the snapshot for `PROJECT_FLEET_CONFIG_VERSION` (target `fleet_config_contract`; it reruns whenever the proto, the templates, a snapshot or the version changes). The differences are classified and the build fails with instructions unless the two match:

| Change | Classification | What to do |
|---|---|---|
| `optional`/`repeated` field added | compatible | refresh the snapshot |
| enum value added | compatible | refresh the snapshot |
| debconf question added with a `Default:` | compatible | refresh the snapshot |
| debconf choice added, default changed | compatible | refresh the snapshot |
| `required` field added | breaking | prefer `optional` plus a validation rule; otherwise bump and migrate |
| field or enum value marked `[deprecated = true]` | breaking | bump and migrate (the migration clears it) |
| field default changed | breaking | bump and migrate |
| debconf question removed or its type changed | breaking | bump and migrate |
| debconf choice removed or renamed (e.g. `echo` to `pam`) | breaking | bump and migrate (the migration maps values) |
| debconf question added without a `Default:` | breaking | bump and migrate (the migration must supply a value) |
| field, message or enum value removed or renamed; field number, type or label changed | forbidden | undo it: mark the old item `[deprecated = true]` instead |

In text format the field *name* is the wire format, so removing or renaming a field would stop every existing fleet config from parsing. Fields are therefore never deleted, only deprecated, and the check refuses a snapshot history that removes anything - including one where the removal was committed together with a version bump.

#### Compatible change

```
fleet-config-contract.py write --proto src/lib/messages/fleet_config.proto \
    --templates debian/jaiabot-embedded.templates \
    --version N --snapshot-dir src/lib/messages/fleet_config/contract
```

where `N` is the current `PROJECT_FLEET_CONFIG_VERSION`. Commit the updated `vN.json`.

#### Breaking change

1. Increment `PROJECT_FLEET_CONFIG_VERSION` in `cmake/JaiaVersions.cmake`.
2. Add the migration step from `N` to `N+1` to the fleet config tool. Removed debconf questions are dropped and added ones are written at their template default automatically from the snapshot difference; renames, value mappings (`echo` to `pam`) and anything without a derivable default are written by hand, and a step that cannot produce a valid result must refuse with a message telling the operator what to change or that the fleet config must be regenerated.
3. Write `vN+1.json` with the command above and commit it alongside the previous snapshots, which are never modified.

### Debugging

`fleet-config-contract.py diff old.json new.json` prints the classified differences between any two contract files, and `src/test/fleet_config/test_contract.py` (run by `ctest` with `-Denable_testing=ON`) exercises the classification and the check on the source tree.
