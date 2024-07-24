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

At its simplest the shorthand is b*N*f*M* for Bot  N on fleet M or h*I*f*J* for Hub I on Fleet J. This uses the local network for fleet operations.

Bots or Hubs may be connected via the Cloud (see the [Cloud Computing](page56_cloud.md) page for more details) or via the service VPN for remote support. In these cases a character before the fleet 'f' is used to indicate the network in use:

- `s` - service VPN (vpn.jaia.tech)
- `v` - VirtualFleet VPN (for virtual bots/hubs)
- `c` - CloudHub VPN (for remote bots/hubs).

Thus, Bot 5 on VirtualFleet 3 would be `b5vf3`, or (real) Hub 1 Fleet 10 via the Cloud would be `h1cf10`. For servicing hosts remotely, Bot 2 on Fleet 4 would be `b2sf4`.

Finally, as a special case "CloudHub" can be referred to as `chfM` for fleet M.

The regex for this host shorthand is `[bh][0-9]+[svc]?f[0-9]+|chf[0-9]+`.

## ip, ping, ssh

These related commands provide remote functionality using host codes given above.

`jaia ip <host>` simply gives the IP address for a given host code, e.g.,

- `jaia ip b1sf2` - Bot 1 Fleet 2 via service VPN
- `jaia ip h3vf1` - Hub 3 VirtualFleet 1

`jaia ssh ` uses the same codes but runs `ssh` to remotely log into the given system. Any parameters passed **after** the host code is passed unmodified to SSH:

- `jaia ssh b3f5` - SSH into Bot3 on Fleet 5
- `jaia ssh b3f5 -A` - SSH into Bot3 on Fleet 5 using `ssh -A` (i.e., Forwarding of connections from `ssh-agent`).

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

## admin

These subactions are used to administer a fleet of JaiaBots. Currently the only subaction is `ssh` which manages SSH keys for a given host. See the [SSH Access](page13_ssh_keys.md) page for more details.