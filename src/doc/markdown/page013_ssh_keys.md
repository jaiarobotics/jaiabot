# SSH Access

The JaiaBots and Hubs require SSH access for several purposes:

- Initial fleet configuration
- Fleet upgrade tasks (via ansible)
- Data offload from bots -> hub
- Debugging and miscellaneous admin tasks

SSH is primarily allowed through FIDO hardware authenticators (the Yubikey product) via OpenSSH's "ed25519-sk" public key type. This provides convenient two-factor authentication ([1] physical key + [2] private key file).

All permissions flow from a set of "root" Yubikeys that are flashed to the image at generation time (jaiabot/config/ssh/root_authorized_keys).

## Root Yubikeys

The root yubikeys are controlled by trusted parties at the JaiaBot headquarters. This always allow access, but only when the Bots/Hubs are accessible via the service VPN (which can be enabled/disabled using the Upgrade GUI).

These keys are stored in `/etc/jaiabot/ssh/root_authorized_keys`.

### Replacing Root Yubikeys

This must currently be done manually, but future upgrades will provide a mechanism by which Root Yubikeys can be revoked during software upgrades (During `apt install jaiabot-embedded`).

## Hub Yubikeys

Each hub ships with its own Yubikey permanently installed into the USB port of the hub. The public key is distributed to all the bots during fleet configuration and is stored in `/etc/jaiabot/ssh/hub_authorized_keys`.

### Replacing Hub Yubikeys

Re-running fleet configuration with a new key will the key for that hub on all bots.

### Test fleets without Yubikeys

For a test fleet (for example a VirtualBox fleet), `jaia admin fleet create --test-keys` (also accepted by `edit`) gives each new hub an ordinary ed25519 key instead of asking for its Yubikey. The private key is then only a file in the fleet config, so anyone with a copy of the config can log in as that hub. Never use it for a real deployment. Such keys are marked by their comment, `hub<N>_fleet<M>_test_key`.

### CloudHub key

*This section written by Claude*

The CloudHub has no Yubikey. It generates its own key on first boot, the private half never leaves it, and the fleet config records only the public half. Every node accepts that key only from the CloudHub's address on the CloudHub VPN. See [CloudHub SSH key](page056_cloud.md#cloudhub-ssh-key).

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
- host: A short code for the bot/hub ID, network, and fleet used elsewhere in the `jaia` tool (see the [Jaia Tool](page005_jaia_tool.md) page).
- pubkey: Either the "comment" of the pubkey if compiled into the tool (e.g. "toby@yubikey16719472")
 or the full public key line as entered into `authorized_keys`. To see keys compiled into the tool, use `jaia admin ssh known`.
- valid_for: How long the key is authorized for, given as an integer followed by "d" for days, "w" for weeks, or "m" for months (or "forever"). For example "5d" is 5 days, "2w" is 2 weeks, and "12m" is 12 months (1 year). This duration is added to the current system clock to determine an "expiry-time" option for the authorized_keys line which is appended to any other options given. The special case "forever" indicates a key that doesn't expire.

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


#### List known keys

```
jaia admin ssh known
```
shows the comment for all the known valid keys.

```
jaia admin ssh known --full
```
shows the full authorized keys line for all known valid keys.

```
jaia admin ssh known --revoked
```
shows the comment for all the revoked keys.	

### Revoked Temporary Yubikeys

Keys can be revoked by adding them to the `revoked_pubkeys` vector in pubkeys.cpp. These keys are no longer allowed to be added (with `jaia admin ssh add`) and can be removed from existing systems using `jaia admin ssh rm <host> --revoked`.


## Customer keys

Customers are free to add SSH keys of any type to `/home/jaia/.ssh/authorized_keys`, which is otherwise empty. When specifying "forever" as the "valid_for" parameter, the keys are defaulted to this file, rather than `/etc/jaiabot/ssh/tmp_authorized_keys`.

The `jaia` tool can add these keys using, for example:

```
jaia admin ssh add chf1 "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIE0e+NIeXQvvd39703nWgZpBm4Dsdfxsg//ajiXiT22GAAAABHNzaDo= somebody@somewhere" forever
```
or by manually editing the `/home/jaia/.ssh/authorized_keys` file.

## Jaia servers

`vpn.jaia.tech` and `packages.jaia.tech` can be managed in the same way, e.g.:

```
jaia admin ssh <action> --user=ubuntu packages.jaia.tech
```
## Support access to a CloudHub

The keys above decide *who* a node will accept. Reaching a customer's CloudHub
turns on something else first: **whether anyone can knock at all.**

Port 22 is shut at the CloudHub's own AWS security group, in the customer's own
account. A grant opens it, for the window the customer approved and only to the
address the request was signed from; the expiry timer shuts it again. The keys
that then work are the root Yubikeys the image already carries, so nothing is
pushed anywhere and nothing has to be taken back.

That is worth stating plainly, because it is the whole design: **reachability is
the control, not key trust.** The customer cannot stop a Yubikey from being a
valid key, and does not need to — they decide whether there is a route to use it
on, in a place Jaia cannot reach.

It also means recovery never depends on our software. If the CloudHub's own
directory will not start, its support page is unreachable too, since that page
sits behind Authelia. The customer opens port 22 from the AWS console and a
Yubikey gets in.

From that shell, bots and hubs are reached as they always are — `jaia admin ssh
add` run on the CloudHub, with the CloudHub's own key already authorized on
every node. There is no second grant.

### Asking for it

The customer's administrator should never have to judge whether a phone call
claiming to be Jaia really is. So the right to ask is tied to the root Yubikeys
rather than to convention. `jaia admin fleet support_request` signs the fleet,
the window, the reason and the address to admit with one of them:

```
jaia admin fleet support_request --fleet 7 --key ~/.ssh/id_ed25519_sk \
    --reason "Pump fault on bot 3" --days 7
```

It prints a block to send to the customer, who pastes it at
`https://support.<their base uri>` — a page beside the directory, behind the
same login, open to `lldap_admin` and `super_admin` at two factors. The CloudHub
verifies the signature against the root keys already on its own image
(`/etc/jaiabot/ssh/root_authorized_keys`) and draws nothing at all for a request
it cannot verify, so a request cannot be forged by anyone who reaches that page.
Approving it is one click, and opens the port. The page shows the customer the
address it will admit before they do.

Granting runs from the approval, not from when the request was made, and no
grant lasts more than two weeks.

The grant is one record, and the firewall is derived from it by a timer that
reconciles every few minutes — so an expiry takes effect with nobody acting, and
a rule with no grant behind it is closed rather than left. The rule is written
both to the security group and to `ufw`: the first is the one that matters,
because AWS enforces it off the instance, and the second so the gate also exists
on a CloudHub that is not in EC2. The support page shows what is open, until
when, and the log of every grant and every ending.

### The fleet's own link, which is a different thing

A hub can disable and re-enable its own tunnel to the CloudHub from its Upgrade
GUI. That decides whether the *fleet* reaches the cloud, and has nothing to do
with support — but the two meet in one place: a hub with its tunnel off is out
of reach even during a live grant.

That control is deliberately local. It acts on the hub it is run from and no
other node, so it can never stop the CloudHub's own end and take the whole fleet
off, and because the GUI serving it runs on that hub over the fleet WLAN, the
link can always be restored on-site. Note that it also carries HUB2HUB, so
cutting it costs inter-hub comms as well.
