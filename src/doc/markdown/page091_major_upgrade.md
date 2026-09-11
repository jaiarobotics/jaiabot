# Major software upgrade

A major software upgrade is defined as updating the Ubuntu release as well as the Jaiabot software release. This is typically done from major Jaiabot versions (e.g., v1 -> v2). It can also be done when a major version spans support for multiple Ubuntu releases (e.g. v1 on Ubuntu "focal" to v1 on Ubuntu "jammy").

## Preparing for major upgrade

### Ensure the Hub has a valid Fleet Configuration

If this fleet was generated prior to fleet configuration files (this includes most 1.y fleets), one will need to be created for the current fleet. This can be done using `jaia admin fleet create` as described in the [Embedded Board Deployment](page025_embedded_setup.md) document.

This fleet configuration must then be embedded in the upgrade image (see the next step).

If the fleet was generated using a fleet configuration file, a valid file on the hub should already exist at `/etc/jaiabot/fleetN.cfg`. In this case that fleet configuration will be reused and no further action is required.

Fleet configurations carry a version (see [Fleet configuration versioning](#fleet-configuration-versioning) below). An older file is migrated automatically by the upgrade when that is possible; when it is not, the upgrade stops on the hub, before any bot is touched, with a message saying what must be changed or that the fleet configuration must be regenerated with `jaia admin fleet create`. To find out in advance, run `jaia admin fleet validate /path/to/fleetN.cfg` with the release you are upgrading to.

Major upgrades go one release at a time (1.y to 2.y to 3.y): the upgrade refuses to skip a release, since each release only migrates fleet configurations from the release before it.


### Download and flash the upgrade image

Download the desired release CD image (e.g. jaiabot_updates_resolute_3.0.0_arm64.iso).

If you need to embed the fleet configuration (see previous section), do so now with:

```
jaia admin fleet update_iso /path/to/fleetN.cfg /path/to/jaiabot_updates_resolute_3.0.0_arm64.iso
```

This migrates and validates the fleet config with the fleet config tool of the release on the ISO, embeds it (at `major_upgrade/fleetN.cfg` within the ISO) and writes a new ISO called `/path/to/jaiabot_updates_resolute_3.0.0_arm64_fleetN.iso`. If the fleet config cannot be used with that release, this is where you find out.

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

The playbook ensures that the new Ubuntu version is newer than the existing version and new Jaiabot version is not older than the existing version, to prevent meaningless double-upgrades or accidental major upgrades that should be normal upgrades (e.g. 1.16.0->1.17.0). It also checks that the system runs the release immediately before the one being installed (`major_upgrade_previous_major` in the ISO's `version.txt`), so releases are never skipped.

On the hub, before anything else, the staged fleet configuration is migrated and validated with the fleet config tool (`jaia-fleet-config.py`) taken from the *new* release's boot tarball on the updates disk (`tasks/hub-check-fleet-config.yml`). A fleet configuration that the new release cannot use stops the upgrade here, on the hub, with the reason.

The upgrade is staged in `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}` where {X} is the major version to be updated to and {ubuntucode} is the new Ubuntu version. For example: `/var/log/jaiabot/major_upgrade/v3_resolute`.

The new upgrade image for the rootfs and bootfs are downloaded from the Hub into the staging directory.

A backup of the old rootfs and overlayfs is copied and compressed to `/var/log/jaiabot/major_upgrade/v{X}_{ubuntucode}/backup/rootfs.tar.gz and overlay.tar.gz`, respectively, as the major upgrade will clear both the old rootfs and overlayfs.

The Wireguard files are copied into the staging directory to be reused to avoid having to reconfigure the service VPN on the new image.

The new boot filesystem is prepared from the fleet configuration file by the fleet config tool found inside the new boot tarball (`jaiabot/init/fleet_config/jaia-fleet-config.py generate`), never by the installed `jaia` tool: this way the template, schema and migrations always come from the release being installed, whatever release the node runs today (so a hub already on the new release can upgrade bots that are still on the previous one). The VPN keys (id_vpn_tmp) are removed to avoid regenerated the service VPN.

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

The fleet configuration is written once when a fleet is created and read again at every major upgrade, possibly years later by a newer release (see the Ansible steps above). This section describes how changes to what a fleet config must contain are tracked, so that a major upgrade either migrates an older file automatically or fails early with a clear message rather than silently producing a misconfigured system.

### The proto is the contract

`src/lib/messages/fleet_config.proto` is the single description of what a fleet config may contain, including the bot/hub settings that debconf asks for on first boot: the `NodeSettings` message lists every question as a typed field, and its `(jaia.field).debconf` options say which nodes it applies to (`group: ALL|BOT|HUB`), whether it is asked before or after another (declaration order), its description, and the few conditions the interactive flow needs (`ask_if`, `unasked_value`). Questions are asked at debconf priority `MEDIUM`, which keeps a question added in a later release from interrupting an interactive `apt upgrade`; `dpkg-reconfigure jaiabot-embedded` asks every question regardless. Enum values map to debconf values by dropping the enum name prefix and lowercasing (`BOT_TYPE_PAM` is `pam`); a deprecated value says what it maps to (`(jaia.ev).debconf.replaced_by`).

From this, `scripts/build/fleet-config-debconf-gen.py` generates `debian/jaiabot-embedded.templates` and `debian/jaiabot-embedded.config`. The build regenerates both whenever the proto or the generator changes, so never edit them by hand. They are committed so that a change to the proto shows its effect on the debconf questions in review; commit the regenerated files with the proto change (the `fleet_config` unit tests fail if the committed copy is stale). Without a build, regenerate them with:

```
scripts/build/fleet-config-debconf-gen.py --write
```

The file itself declares its contract version:

```
option (jaia.file).fleet_config_version = 2;
```

`PROJECT_FLEET_CONFIG_VERSION` in CMake is read from that line. Fleet configs record the version they were written for in their `version` field; files that predate the field are version 1 (every file created before the 3.y release). A tool refuses a file newer than itself.

The build writes `share/jaiabot/fleet_config/fleet_config.desc` (a protobuf `FileDescriptorSet` of the proto and its options). It is all the fleet config tool needs to parse, validate, migrate and render fleet configs, without generated bindings, which is what lets the tool run on a node of the previous release during a major upgrade.

### The fleet config tool

`jaia-fleet-config.py` (`src/sh/fleet/`) is behind `jaia admin fleet`:

| Command | Purpose |
|---|---|
| `jaia admin fleet version` | the fleet config version this release writes |
| `jaia admin fleet validate fleetN.cfg` | report the file's version, whether it can be migrated, and every problem |
| `jaia admin fleet migrate fleetN.cfg [-o out.cfg] [--check]` | rewrite the file at the current version |
| `jaia admin fleet generate fleetN.cfg <bot\|hub> <id>` | first-boot files for one node; migrates in memory and stores the migrated file on hubs |
| `jaia admin fleet create` | interactive creation; writes the current version |
| `jaia admin fleet update_iso` | migrate and validate with the tool of the release *on the ISO*, then embed |

It is copied into the boot partition of every image (`jaiabot/init/fleet_config/`, next to `first-boot.preseed.yml.j2`) together with `fleet_config.desc`, so the major upgrade runs the new release's tool from the new boot tarball, on the hub and on every node. It renders the first-boot template with Jinja2's `StrictUndefined`, so a missing value is an error rather than a blank line, and the template's first line dereferences a variable only this tool defines, so an older generator fails on it instead of writing a broken preseed.

### Migrations

A fleet config older than the current version is migrated one version at a time by the steps in `MIGRATIONS` in `jaia-fleet-config.py`. Migration happens in memory whenever a file is read (`validate`, `generate`, `update_iso`), and is written back by `migrate`; hubs always store the migrated form so the next upgrade starts from a known version. A step either produces a file that passes validation or refuses with a list of problems naming the fields and values concerned (never their values, which may be secrets); the operator then fixes the file or regenerates it.

Version 1 to 2 turns the string debconf answers (`debconf { key: "jaiabot-embedded/bot_type" value: "echo" }`) into the typed `settings { bot_type: BOT_TYPE_PAM }`, mapping deprecated values through `replaced_by`, dropping identity answers (type, ids, mode: those are set per node) with a note, refusing unknown questions and values, and writing every unanswered question at its default so the file is a complete record.

### The build-time check

`fleet_config_contract` (built as part of `all`) compares the current proto against the frozen copy for the version it declares, `src/lib/messages/fleet_config/contract/vN/fleet_config.proto` (plus, for version 1 whose questions were still a hand-written templates file, `jaiabot-embedded.templates`). It reruns whenever the proto, a snapshot or the tool changes. Differences are classified and the build fails with instructions unless the two match:

| Change | Classification | What to do |
|---|---|---|
| `optional`/`repeated` field added | compatible | refresh the snapshot |
| enum value added (a new choice) | compatible | refresh the snapshot |
| question added with a default | compatible | refresh the snapshot |
| a setting's default changed | compatible | refresh the snapshot (fleet configs carry explicit values) |
| `required` field added | breaking | prefer `optional` plus a validation rule; otherwise bump and migrate |
| field or enum value marked `[deprecated = true]` | breaking | bump and migrate (the migration clears or maps it) |
| a `FleetConfig` field's default changed | breaking | bump and migrate |
| question added without a default | breaking | bump and migrate (the migration must supply a value) |
| whether a question is set per node changed | breaking | bump and migrate |
| field, message or enum value removed or renamed; field number, type or label changed | forbidden | undo it: mark the old item `[deprecated = true]` instead |

In text format the field *name* is the wire format, so removing or renaming a field would stop every existing fleet config from parsing. Fields are therefore never deleted, only deprecated, and the check refuses a snapshot history that removes anything - including a removal committed together with a version bump.

#### Compatible change

```
scripts/build/fleet-config-contract.py write
```

refreshes the snapshot for the declared version; commit it.

#### Breaking change

1. Increment `option (jaia.file).fleet_config_version` in `fleet_config.proto`.
2. Add `migrate_N_to_N1` to `MIGRATIONS` in `src/sh/fleet/jaia-fleet-config.py`. Deprecated values are mapped by `replaced_by` automatically; anything without a derivable value must refuse with a message telling the operator what to change.
3. `scripts/build/fleet-config-contract.py write` and commit `contract/vN+1/` alongside the previous snapshots, which are never modified.
4. Add a fixture and a migration test under `src/test/fleet_config/`.

### Debugging

`scripts/build/fleet-config-contract.py diff 1 2` prints the classified differences between two snapshot versions, `show` prints the current contract model, and `src/test/fleet_config/` (run by `ctest -R fleet_config` with `-Denable_testing=ON`) exercises the classification, the check, the generator and the tool's migrations against fixtures.
