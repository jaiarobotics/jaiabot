---
name: jaia-fleet-create
description: Build a new 3.y JaiaBot fleet with a CloudHub — fleet config, `jaia admin fleet cloudhub create`, DNS, commissioning account, node boot files and pairing. Use when a technician asks to create, provision or commission a new fleet or CloudHub, to provision a fleet's bots and hubs, or to pair a fleet to its CloudHub, including resuming part way through.
---

# Build a new fleet with a CloudHub

Follow `references/checklist.md` step by step with a Jaia technician. It is the whole
procedure and stands on its own; this file says what you do, what they do, and how you
check. Say at each step which it is.

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

## Checks

```
scripts/preflight.sh --part A --fleet <N> --region <region> --repo <repo> [--base-uri <name>] [--config fleetN.cfg]
scripts/preflight.sh --part B --config fleetN.cfg
scripts/preflight.sh --part C --config fleetN.cfg
scripts/check_dns.sh <base uri> <CloudHub IPv4> [--wait <s>]
scripts/check_cloudhub.sh <base uri> [--ip <IPv4>] [--ssh]     # --ssh only while pairing is open
scripts/check_node.sh <address> [--paired]
scripts/pi_image.sh <repo> [--download <dir>]
```

FAIL stops the part; explain every WARN. Run `preflight.sh --part A … --config` after
`fleet create` (A2) and before `cloudhub create` (A3). Preflight warns when the AMI and
the `jaia` tool are different releases: resolve that first. When something fails, look
in `references/troubleshooting.md` before trying anything else.

## Notes on the steps

- **A2**: walk the technician through the answers in the checklist before they start.
- **A3**: run it from the checkout (it needs `rootfs/cloud/aws`); keep `--output-json`.
  Copy the DNS records, SMTP note and account steps it prints into the record.
- **A4**: give the technician the records exactly as printed; `check_dns.sh … --wait`
  while they enter them.
- **B**: confirm the device with the technician before anything writes to a card.
- **C3**: `check_node.sh --paired` on every node, then the JCC check.
