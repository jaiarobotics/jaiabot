# Jaia Tool

The `jaia` command line tool aims to be the single entry point for all advanced configuration and administration of JaiaBots and Hubs.

## Usage

The `jaia` tool has numerous actions (some of which have subactions of their own). To see the full list of actions available, type:

```
jaia help
```

To see the options of an action, you can type (for example, the `version` action):

```
jaia help version
```

This works recursively for any child action, e.g.,

```
jaia admin ssh help add
```

## Common Concepts

Many of the actions (`jaia ip`, `jaia ping`, `jaia ssh`) act on another (remote) host (Bot or Hub). The remote host is specified using a shorthand that encodes the host type (bot or hub), ID, network, and fleet ID.

At its simplest the shorthand is bNfM for Bot  N on fleet M or hIfJ for Hub I on Fleet J. This uses the local network for fleet operations.

Bots or Hubs may be connected via the Cloud (see the [Cloud Computing](page056_cloud.md) page for more details) or via the service VPN for remote support. In these cases a character before the fleet 'f' is used to indicate the network in use:

- `s` - service VPN (vpn.jaia.tech)
- `v` - VirtualFleet VPN (for virtual bots/hubs)
- `c` - CloudHub VPN (for remote bots/hubs).

Thus, Bot 5 on VirtualFleet 3 would be `b5vf3`, or (real) Hub 1 Fleet 10 via the Cloud would be `h1cf10`. For servicing hosts remotely, Bot 2 on Fleet 4 would be `b2sf4`.

Additionally, if you are on a bot or hub, you can omit `fN` and the current fleet will be used. The fleet is taken from the `jaia_fleet_id` environmental variable, which login shells pick up from `/etc/profile.d/jaia.sh` (which reads `/etc/jaiabot/jaia.env`, written from the debconf database when `jaiabot-embedded` is configured). Where no profile has been sourced — for example under `cron` or `ssh <host> <command>` — the fleet is read from the hostname instead (`hub0-fleet3`).

The host shorthand format is `b<bot_id>[svc]f<fleet_id>`, `h<hub_id>[svc]f<fleet_id>` or `chf<fleet_id>` (for CloudHub); the `f<fleet_id>` portion may be omitted as described above. Parsing is implemented in `jaiabot::parse_host_code` (`src/lib/utils/ip.h`).

### Special cases

Several special cases exist for the host string:
- "CloudHub" can be referred to as `chfM` for fleet M
- "self" can be used to refer to the machine that `jaia` is being run on (that is, localhost).
- "xxx.jaia.tech" is passed through unmodified (vpn.jaia.tech, packages.jaia.tech).

## ip, ping, ssh

These related commands provide remote functionality using host codes given above.

`jaia ip <host>` simply gives the IP address for a given host code, e.g.,

- `jaia ip b1sf2` - Bot 1 Fleet 2 via service VPN
- `jaia ip h3vf1` - Hub 3 VirtualFleet 1
- `jaia ip b4` - Bot 4 for the same fleet as the machine this was run on.

`jaia ip` is a thin wrapper around the standalone `jaia_ip` binary, which can also be run directly (`jaia_ip b1sf2`). `jaia_ip` does not load the `jaia` tool (or goby/protobuf) and so starts up considerably faster; prefer it in scripts and other non-interactive callers that query many addresses. `jaia_ip` additionally supports an explicit query mode (`jaia_ip --query_type net --fleet_id 3 --ip_net fleet_vpn --ip_version ipv4`); see `jaia_ip --help`.

`jaia ssh ` uses the same codes but runs `ssh` to remotely log into the given system. Any parameters passed **after** the host code is passed unmodified to SSH:

- `jaia ssh b3f5` - SSH into Bot3 on Fleet 5
- `jaia ssh b3f5 -A` - SSH into Bot3 on Fleet 5 using `ssh -A` (i.e., Forwarding of connections from `ssh-agent`).
- `jaia ssh b4` - SSH into Bot 4 on this fleet.


`jaia ping` is just like `jaia ssh` but runs `ping` to check connectivity to a host. Similarly, all parameters after the host code are appended to the `ping` command line unmodified.

## version

On a given system the version action provides the software version of the `jaiabot` code and its primary dependencies (Goby, MOOS, IvP, etc.).

- `jaia version` - list all versions
- `jaia version --format=json` list all versions in JSON
- `jaia version jaiabot` lists just the jaiabot version.

As usual, `jaia help version` gives the full set of options.

Keep in mind that you can pair `jaia ssh` with any command to execute it remotely. For example, to see the versions of jaiabot and friends running on CloudHub for Fleet 1:

```
jaia ssh chf1 jaia version
```

## status

`jaia status` provides a summary of the systemd status of the JaiaBot services (this is the same output you receive on the SSH login MOTD).

## ctl

This is a thin wrapper around systemctl for `jaiabot` services.

- `sudo jaia ctl stop` - same as `sudo systemctl stop jaiabot`
- `sudo jaia ctl start` - same as `sudo systemctl start jaiabot`
- `sudo jaia ctl restart` - same as `sudo systemctl restart jaiabot`
- `sudo jaia ctl restart jaiabot_goby_gps` - same as `sudo systemctl restart jaiabot_goby_gps`

As always, you can use `jaia ssh` to execute remotely, e.g. to restart all services on Bot1 for Fleet10:

```
jaia ssh b1f10 sudo jaia ctl restart
```

## doc

`jaia doc` provides command line access to this documentation (Markdown). Run with no arguments to list all the available pages, or provide a page name to display it in the terminal.

## admin

The `jaiabot-embedded` debconf database is the single source of truth for a bot or hub's configuration, and the generated systemd units are derived from it. This subaction reads and writes it without having to go through the interactive `dpkg-reconfigure` menus. Questions are named without the `jaiabot-embedded/` prefix.

```
jaia admin debconf list
jaia admin debconf get fleet_id
jaia admin debconf set fleet_id 3
```

Reading and writing the debconf database requires root, so `get` and `set` re-run themselves under `sudo` when they are not already root - there is no need to remember to prepend it. (`list` does not, since it does not read the database.)

`get` with no question reports what everything is currently set to, which is the counterpart to `list`'s "what can I set?":

```
QUESTION                  VALUE
bot_id                    (unset)
comms_links               xbee,wifi
fleet_id                  3
type                      bot
```

Questions that have never been answered show as `(unset)`, which is distinct from one deliberately set to the empty string. Unlike `jaia-debconf.sh selections` - which emits `debconf-set-selections` format for another machine to re-import - this is meant for reading.

`list` shows every question the package defines, along with its type, default and permitted choices - that is, what you can pass to `get` and `set`:

```
QUESTION                  TYPE         DEFAULT   CHOICES
additional_sensors        multiselect  none      turner_c_flour, aml, ppk, none
arduino_type              select       none      spi, usb, none
bot_id                    select                 0-150
bot_type                  select       hydro     hydro, pam, bio, none
...
```

Long runs of consecutive integers are shown as a range (`0-150`) rather than in full. `list` reads the package's templates rather than the debconf database, so it describes what *can* be set. Both `list` and a bare `get` take `--all`, which also shows the internal `debconf_state_*` questions - those record where the interactive menu is rather than any configuration.

`set` validates the value against that question's permitted `Choices`, so a typo fails immediately rather than silently generating the wrong services. By default it then runs `dpkg-reconfigure jaiabot-embedded`, which regenerates and re-enables the systemd units so the change takes effect.

When changing several values, skip the reconfigure on all but the last so the units are only regenerated once:

```
jaia admin debconf set imu_type bno085 --reconfigure false
jaia admin debconf set bot_type pam
```

As with any action, these can be run remotely:

```
jaia ssh b1f10 jaia admin debconf get imu_type
```
