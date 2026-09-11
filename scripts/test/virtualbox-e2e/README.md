# VirtualBox end-to-end test

`jaia-vbox-e2e-test.py` takes a VirtualBox OVA built by CircleCI and checks that a
fleet imported from it actually works: the VMs boot, the hubs are reachable from
the host, the REST API drives a bot to a waypoint, and JCC, JCU and JDV are
served.

## Requirements

- VirtualBox, with `vboximg-mount` (part of the VirtualBox package).
- `jaia_ip` and `jaia` on `PATH` — either the `jaiabot-embedded` package, or this
  source tree's `build/amd64/bin`.
- A public key in `~/.ssh/*.pub`; `import_vms.sh` installs all of them on every
  node. Pass the matching private key with `--ssh-key` (default `~/.ssh/id_rsa`).
- Root, for the `import` stage only: `import_vms.sh` mounts each imported disk to
  write the node's preseed.

## Running it

```bash
PATH=$PWD/build/amd64/bin:$PATH ./scripts/test/virtualbox-e2e/jaia-vbox-e2e-test.py \
    --ova-url https://jaia-disk-images.s3.us-east-1.amazonaws.com/continuous/3.y/vbox/<image>.ova \
    --fleet 300 --bots 1,2 --hubs 1,2
```

An OVA already on disk is used with `--ova` instead, which skips the download.

If bots or hubs of the same name already exist in the OVA's VirtualBox group the
script lists them and asks before deleting and re-importing; `--yes` answers yes.

A newer OVA of the same branch lands in its own group, so it does not clash by
name - but importing it re-creates the fleet's NAT network and strands the nodes
of the previous OVA, whose NIC 2 is left on a network that no longer carries their
address. The same prompt therefore also offers to delete fleet nodes left behind by
an earlier OVA.

## Stages

Stages run in order and are selected with `--stages`, so a run can be resumed or
a single check repeated (`--stages api,web`) against a fleet that is already up.

| Stage | What it does |
|-------|--------------|
| `download` | Fetches the OVA into `--cache-dir`, resuming a partial file and checking the length against the server's |
| `import` | Deletes clashing VMs (after asking) and runs `rootfs/scripts/import_vms.sh` |
| `hostonly` | Creates `vboxnet0` if needed, addresses it `192.168.56.1/24`, and moves each hub's NIC 1 to it |
| `boot` | Starts every VM headless and waits for SSH, for the first-boot reboot onto the overlay root, and for cloud-init to finish |
| `network` | Sets `jaia_network_eth_address` in each hub's `/etc/jaiabot/network.env`, runs `jaia-update-network.sh`, reloads networkd, and waits for the hub to answer on its host-only address |
| `api` | Waits for the REST API on each hub, then activates a bot, sends it a single-goal `MISSION_PLAN`, and waits for it to reach the waypoint and enter a recovery state |
| `web` | Fetches JCC (`/`), JCU (`/jcu/`) and JDV (`/jdv/`) from each hub and checks the bodies |
| `shutdown` | ACPI power button on every VM, falling back to a forced power off |

The VMs are left imported and registered — only powered off.

## Interpreting a failure

The stages are ordered so that the earliest one to fail names the layer at fault:
`boot` failing is the image or the import, `network` failing is VirtualBox or
networkd, `api` failing with the hubs answering but no bots reporting is the bot
software or the fleet link, and `web` failing on its own is apache or one of the
proxied apps.

When `api` reports the hubs up but no bots, the fastest next step is
`systemctl --failed` over the SSH forward on a bot: every jaiabot app there is
`BindsTo=jaiabot_health.service`, so one config-generation error in
`config/gen/bot.py` takes the whole bot down at once.

## Addressing

Hub *N* gets host-only address `.(10 + N)` on `--hostonly-net` (default
`192.168.56.0/24`), so hub1 is `192.168.56.11` and hub2 is `192.168.56.12`. The
host end of the network is `.1`.

The fleet's own addressing is untouched: bots and hubs talk to each other over
NIC 2 on the `jaiafleet<N>` NAT network, and the script finds each node's
forwarded host SSH port by reading the port-forward rules back from that network
rather than recomputing them.
