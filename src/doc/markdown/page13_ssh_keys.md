# SSH Access

The JaiaBots and Hubs require SSH access for several purposes:

- Initial fleet configuration
- Fleet upgrade tasks (via ansible)
- Data offload from bots -> hub
- Debugging and miscellaneous admin tasks

SSH is primarily allowed through FIDO hardware authenticators (the Yubikey product) via OpenSSH's “ed25519-sk" public key type. This provides convenient two-factor authentication ([1] physical key + [2] private key file).

All permissions flow from a set of "root" Yubikeys that are flashed to the image at generation time (jaiabot/rootfs/customization/includes.chroot/etc/jaiabot/ssh/root_authorized_keys).

## Root Yubikeys

The root yubikeys are controlled by trusted parties at the JaiaBot headquarters. This always allow access, but only when the Bots/Hubs are accessible via the service VPN (which can be enabled/disabled using the Upgrade GUI).

These keys are stored in `/etc/jaiabot/ssh/root_authorized_keys`.

### Replacing Root Yubikeys

This must currently be done manually, but future upgrades will provide a mechanism by which Root Yubikeys can be revoked during software upgrades (During `apt install jaiabot-embedded`).

## Hub Yubikeys

Each hub ships with its own Yubikey permanently installed into the USB port of the hub. The public key is distributed to all the bots during fleet configuration and is stored in `/etc/jaiabot/ssh/hub_authorized_keys`.

### Replacing Hub Yubikeys

Re-running fleet configuration with a new key will the key for that hub on all bots.

## Temporary Yubikeys

For various reasons (repairs, debugging, etc.), keys may need to be temporarily authorized that belong to JaiaBot employees, repair facilities, etc. These keys are stored in `/etc/jaiabot/ssh/tmp_authorized_keys` and are set with a timeout corresponding to the required time to perform the necessary activities.

These must be provisioned by a system with existing SSH access, typically via the root Yubikeys.

### Provisioning Temporary Yubikeys

The `jaia` command line tool can be used to add temporary Yubikeys to a given system (via the `jaia admin ssh` set of actions).

For convenience, known trusted public keys are compiled into the source code at `jaiabot/src/bin/tool/actions/admin/ssh/pubkeys.cpp` (in the `pubkeys` vector). Revoked (lost, stolen, damaged) keys are also listed within this file.

Each authorized public key in OpenSSH is formatted as such (see https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT):

```
[options] <type> <base64-encoded key> <comment>
```

This format is what we also use here with the `jaia` tool.

#### Add a key

To add a key to a Bot or Hub, run:
```
jaia admin ssh add <host> <pubkey> <valid_for>
```

where the parameters are:
- host: A short code for the bot/hub ID, network, and fleet used elsewhere in the `jaia` tool (see the [Jaia Tool](page05_jaia_tool.md) page).
- pubkey: Either the "comment" of the pubkey if compiled into the tool (e.g. "toby@yubikey16719472")
 or the full public key line as entered into `authorized_keys`.
- valid_for: How long the key is authorized for, given as an integer followed by "d" for days, "w" for weeks, or "m" for months. For example "5d" is 5 days, "2w" is 2 weeks, and "12m" is 12 months (1 year). This duration is added to the current system clock to determine an "expiry-time" option for the authorized_keys line which is appended to any other options given.

This entry is added to `/etc/jaiabot/ssh/tmp_authorized_keys`, replacing the same key if it already exists.

For example,

```
jaia admin ssh add b1sf0 jaia@repair_test1 2w
```
adds the key corresponding to the comment "jaia@repair_test1" in pubkeys.cpp to Bot 1 on Fleet 0 (over the service VPN) for a period of 2 weeks. This key is only allowed to run `/usr/share/jaiabot/config/fleet/fleet-config.sh` as defined in pubkeys.cpp.

For another example,

```
jaia admin ssh add h1sf3 toby@yubikey16719472 3d
```

adds Toby's contractor/employee key 16719472 (also defined in pubkeys.cpp) for 3 days to the Hub 1 on Fleet 3 so he can perform debugging requested by the customer.


#### Remove (rm) a key

To remove a given key run:

```
jaia admin ssh rm <host> <pubkey>
```

where the parameters are the same as for adding a key.

Alternatively,

```
jaia admin ssh rm <host> --revoked
```
removes all known (compiled-in) revoked public keys on that host.

#### List keys

```
jaia admin ssh list <host>
```

shows all the authorized keys on the host and which file they reside in.

#### Clear keys

```
jaia admin ssh clear <host>
```

removes all temporary keys from the host.


### Revoked Temporary Yubikeys

Keys can be revoked by adding them to the `revoked_pubkeys` vector in pubkeys.cpp. These keys are no longer allowed to be added (with `jaia admin ssh add`) and can be removed from existing systems using `jaia admin ssh rm <host> --revoked`.


## Customer keys

Customers are free to add SSH keys of any type to `/home/jaia/.ssh/authorized_keys`, which is otherwise empty.

The `jaia` tool can add these keys using, for example:

```
jaia admin ssh add --authorized_keys_file=/home/jaia/.ssh/authorized_keys chf1 "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIE0e+NIeXQvvd39703nWgZpBm4Dsdfxsg//ajiXiT22GAAAABHNzaDo= somebody@somewhere" 12m
```
or by manually editing the file.