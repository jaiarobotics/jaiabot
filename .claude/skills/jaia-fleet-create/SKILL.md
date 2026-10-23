---
name: jaia-fleet-create
description: Build a new 3.y JaiaBot fleet with a CloudHub — fleet config, `jaia admin fleet cloudhub create`, DNS, commissioning account, node boot files and pairing. Use when a technician asks to create, provision or commission a new fleet or CloudHub, to provision a fleet's bots and hubs, or to pair a fleet to its CloudHub, including resuming part way through.
---

# Build a new fleet with a CloudHub

Follow `references/checklist.md` step by step with a Jaia technician. It is the whole
procedure, in `jaia` commands and browser steps, and stands on its own; this file says
what you do, what they do, and how you check each step. Say at each step which it is.

**The fleet config is what joins the parts.** Ask for its path; read where the fleet
stands from it and from the fleet itself, never from memory of an earlier session; ask
which part is wanted; run that part's preflight.

## Who does what

- **You**: the preflights and checks, `cloudhub create`, `generate`, the record.
- **The technician**: `jaia admin fleet create` (dialogs, Yubikey touches: their own
  terminal), the Yubikey touches during `cloudhub create`, DNS at the provider, writing
  SD cards, every browser step.
- **The customer**: the hand-over (C5). Ask before treating it as part of the job.

## Rules

- **Confirm before anything that costs money or can't be undone**: `cloudhub create`,
  `cloudhub delete`, writing an SD card, deleting `jaia_bootstrap`.
- **Never handle the commissioning credentials**: never ask for or store
  `jaia_bootstrap`'s password or TOTP secret.
- **Never weaken TLS or open SSH yourself**: no security-group edits, no `curl -k`.
- **No hand fixes on CloudHubs or nodes**: stop, explain, point at
  `references/troubleshooting.md`; a workaround is the technician's call, recorded.
- **Fleet configs hold private keys**: `chmod 600`, never print or paste them; show
  settings by grepping the field.
- **Keep the record**: `fleet<N>-record.md` next to the config, from
  `references/record-template.md`, after every step, with the evidence.

## Checks, by checklist step

FAIL stops the part; explain every WARN. When something fails, look in
`references/troubleshooting.md` before trying anything else.

- **A1**: `scripts/preflight.sh --part A --fleet <N> --region <r> --repo <repo> --base-uri <name>`
  (AWS as the technician, the AMI, no VPC for the fleet, SSH agent, Yubikey, DNS not
  yet taken). A WARN that the AMI and the `jaia` tool are different releases must be
  resolved first.
- **A2**: walk the technician through the answers first. Then
  `scripts/preflight.sh --part A … --config fleetN.cfg`: refuses a simulation, a config
  without a CloudHub, another fleet or base URI, or one already through `cloudhub create`.
- **A3**: run it from the checkout (it needs `rootfs/cloud/aws`); keep `--output-json`.
  Copy the DNS records, SMTP note and account steps it prints into the record.
- **A4**: give the records exactly as printed; `scripts/check_dns.sh <base uri> <IPv4> --wait 1800`
  (the zone's own name servers and public resolvers) while they enter them.
- **A5**: `scripts/check_cloudhub.sh <base uri> --ip <IPv4>` until every site passes
  (`--ip` ignores this workstation's resolver); it also reports ports 22 and 2222 closed.
- **A8**: on a "Connection to Hub Dropped" banner, `scripts/check_cloudhub.sh … --ssh`
  under a shell support grant: `jaia admin fleet support_request --scopes shell` (a
  Yubikey touch), approved by the technician as `jaia_bootstrap` on
  `https://support.<base uri>`. Fleet pairing no longer opens port 22.
- **B1**: download the image for the technician without being asked:
  `scripts/pi_image.sh <repo> --download <config dir>/image` (public HTTPS, no AWS; it
  checks the size and the gzip), and give them the path. By hand it is written with
  `gunzip -c <image> | sudo dd of=/dev/<card> bs=4M status=progress`; confirm the device
  with the technician before anything writes to it.
- **B**: `scripts/preflight.sh --part B --config fleetN.cfg` (warns without the CloudHub
  key); `scripts/check_node.sh <address>` once a node is up (`jaia_ip h<id>f<N>` /
  `b<id>f<N>` on the fleet Wi-Fi): id, release, units, radios; waits up to two minutes
  for a hub's first health report.
- **C**: `scripts/preflight.sh --part C --config fleetN.cfg`; **C1**
  `scripts/check_cloudhub.sh <base uri>` shows the pairing port (2222) open; **C3**
  `scripts/check_node.sh <address> --paired` on every node (tunnel, handshake, UDP
  32000), then the JCC check; **C4** `scripts/check_cloudhub.sh <base uri>` shows
  it closed again.
