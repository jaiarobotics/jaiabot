---
name: jaia-fleet-create
description: Build a new 3.y JaiaBot fleet with a CloudHub — fleet config, `jaia admin fleet cloudhub create`, DNS, commissioning, node boot files and pairing — following Confluence checklist 1 ("Provisioning and Upgrading: 3.y"). Use when a technician asks to create, provision or commission a new fleet or CloudHub, to provision a fleet's bots and hubs, or to pair a fleet to its CloudHub, including resuming any of those part way through.
---

# Build a new fleet with a CloudHub

You are guiding a Jaia technician, in the office with good internet, through
[checklist 1 of "Provisioning and Upgrading: 3.y"](https://jaia-innovation.atlassian.net/wiki/spaces/PD/pages/3051552794).
You run the commands and checks that are safe to run; the technician does what needs
their hands, their Yubikey or their own sign-in. Say plainly at each step which it is.

The work comes in three parts, often done on different days, by different people, on
different workstations:

| Part | What | Needs |
| --- | --- | --- |
| **A. CloudHub** | fleet config, CloudHub, DNS, commissioning account | a JaiaBot checkout of the release, the jaia tool, `aws login`, a Yubikey per physical hub, the DNS provider |
| **B. Provision the nodes** | images and boot files for each bot and hub | the jaia tool, the fleet config, the SD cards — no AWS, no checkout |
| **C. Final pairing** | join every node to the CloudHub VPN, hand over | a browser signed in as `jaia_bootstrap`, the fleet Wi-Fi, the fleet config — no AWS |

**The fleet config is what joins them.** Part A writes it (and `cloudhub create`
records the CloudHub's key in it); B and C start from it and nothing else. Ask for its
path, and read where the fleet stands from it and from the fleet itself, never from
memory of an earlier session. Ask which part the technician wants, then check.

## Rules

- **Confirm before anything that costs money or can't be undone**: `cloudhub create`,
  `cloudhub delete`, writing an SD card, deleting `jaia_bootstrap`.
- **Never handle the commissioning credentials.** The technician claims `jaia_bootstrap`
  in their own browser; never ask for, store or type its password or TOTP secret.
- **Never weaken TLS or open SSH yourself.** Port 22 on a CloudHub opens only through
  the JCU's "Open Fleet Pairing" (or a customer's support grant). No security-group
  edits, no `-k`, no HTTP fallbacks.
- **No hand fixes on CloudHubs or nodes.** If something needs one, stop, explain it, and
  point at `references/troubleshooting.md`. A workaround on customer equipment is the
  technician's call, and goes in the record.
- **Fleet configs hold private keys.** Keep them `chmod 600`, never print them, and
  never paste them into chat. Show settings with `jaia admin fleet validate` or by
  grepping for the field.
- **Keep the record** (below) as you go.

## The record

Keep `fleet<N>-record.md` next to the fleet config, started from
`references/record-template.md`. After every step, write what was done, when, and the
evidence (a command's last lines, a check's output). It is the job's paperwork and a
help to whoever comes next — but the fleet config and the fleet itself are the truth.

## Where is this fleet?

Start every part with its preflight; it reads the fleet config and checks only what
that part needs:

```
scripts/preflight.sh --part A --fleet <N> --region <region> --repo <repo> [--base-uri <name>]
scripts/preflight.sh --part B --config fleetN.cfg
scripts/preflight.sh --part C --config fleetN.cfg
```

From the config: the fleet id, the base URI, the hubs and bots, and whether the
CloudHub has been made (`cloudhub create` records its key as hub 30's). Then, as the
part needs them:

- DNS: `scripts/check_dns.sh <base uri> <CloudHub IPv4>` (the IPv4 `cloudhub create`
  printed, or what the base URI resolves to on the zone's name servers)
- The CloudHub: `scripts/check_cloudhub.sh <base uri>`
- Each node: `scripts/check_node.sh <address> [--paired]`; `jaia_ip h<id>f<fleet>` or
  `jaia_ip b<id>f<fleet>` gives a node's fleet Wi-Fi address.

Then say which part is next and why.

## A. CloudHub

1. **Preflight.** Ask for the fleet id, region (usually `ca-central-1` or `us-east-1`),
   repo (`release` for customers; `beta`, `continuous` or `test` otherwise), and base URI
   (e.g. `fleet9.jaia.tech`, or a customer domain). Run `scripts/preflight.sh --part A`.
   Stop on any FAIL. Explain any WARN; a release mismatch between the AMI and the jaia
   tool must be resolved first.

2. **Fleet config — technician's terminal.** `jaia admin fleet create` asks its
   questions in dialogs and needs a Yubikey touch per hub, so the technician runs it in
   their own terminal, not through you:

   ```
   jaia admin fleet create fleetN.cfg
   ```

   Before they start, walk them through the answers: fleet id; real (not simulation);
   **CloudHub: yes**; the hub and bot ids; a Yubikey per physical hub; permanent SSH keys
   (their own and Jaia's); the fleet Wi-Fi password; **"Should each node's CloudHub VPN
   start by itself at boot?": yes** — answered no, the fleet pairs but its tunnels stay
   down; the base URI; the customer's admin email; SMTP defaults (Postmark) unless the
   customer has their own; the customer name (the `jaia_customer` AWS tag; one name per
   customer); comms links — **only radios the hardware actually has** (a hub configured
   for an XBee it lacks never reports anything). Then: `chmod 600 fleetN.cfg` and
   `jaia admin fleet validate fleetN.cfg`.

3. **Create the CloudHub — you, once confirmed.** Takes about five minutes.

   ```
   jaia admin fleet cloudhub create fleetN.cfg --region <region> --repo <repo> \
       --bootstrap-email <Jaia commissioning address> --output-json cloudhubN.json
   ```

   Run it from the checkout (it needs `rootfs/cloud/aws`). It records the CloudHub's
   key in `fleetN.cfg` and ends with the DNS records to add, the SMTP note and the
   account instructions; copy those into the record. `cloudhubN.json` lists the AWS
   resources it made, for the record and for teardown. "Connection refused" and
   "Permission denied" while it waits for the CloudHub are expected.

4. **DNS — technician, at whichever provider hosts the base URI's domain** (often
   get.tech; sometimes the customer's). Give them exactly the records `cloudhub create`
   printed:

   ```
   <name>     A      <IPv4>
   <name>     AAAA   <IPv6>
   *.<name>   CNAME  <base uri>.
   ```

   Then `scripts/check_dns.sh <base uri> <IPv4> --wait 1800`. It asks the zone's own name
   servers and public resolvers; the workstation's own resolver may lag (harmless).

5. **Certificates.** `scripts/check_cloudhub.sh <base uri>` until every site passes —
   usually within two minutes of DNS. If they don't come, see "Let's Encrypt" in
   troubleshooting before retrying anything.

6. **Commissioning account — technician's browser.** At `https://<base uri>`, "Reset
   password?" for `jaia_bootstrap`; the email goes to the bootstrap address. They set a
   password and a second factor. Every later browser step is signed in as
   `jaia_bootstrap`.

7. **Optional: VirtualFleet.** CloudHub JCU (`https://run.<base uri>/jcu/`) → VirtualFleet
   → "(Re)create VirtualFleet machines", a few bots, confirm; stop it afterwards
   ("Start or Stop VirtualFleet machines" → stopped) so it doesn't run up cost. Without
   it the Sim page only says the VirtualFleet isn't running.

8. **Check every site — technician, with you.** Run (JCC), JCU, JDV, Sim, Users,
   Support, Account. JCC must show **HUB Cloud** with no "Connection to Hub Dropped"
   banner; if it shows the banner, run `scripts/check_cloudhub.sh <base uri> --ssh`
   during a pairing window (step C1).

Part A is done when DNS, certificates and the sites pass and `jaia_bootstrap` is
claimed. Record it, and tell the technician that **the fleet config, as `cloudhub
create` left it, is what parts B and C need** — kept `chmod 600`, wherever their team
keeps fleet configs.

## B. Provision the nodes

Start with `scripts/preflight.sh --part B --config fleetN.cfg`; it fails if the config
has no CloudHub key yet. Then, for each bot and hub, with its SD card:

1. **Image — technician, with your help finding it.** `scripts/pi_image.sh <repo>`
   prints the current Raspberry Pi image for the same repo as the CloudHub (public
   HTTPS, no AWS), and `--download <dir>` fetches it. They write it with Raspberry Pi
   Imager, or `gunzip -c … | sudo dd of=/dev/<card> bs=4M status=progress` — confirm the
   device with them before anything writes to it.
2. **Boot files — you, with the card's boot partition mounted.**

   ```
   jaia admin fleet generate fleetN.cfg <hub|bot> <id>
   ```

   It finds the mounted boot partition (or pass `--bootdir`), and writes the node's
   keys, first-boot settings, the CloudHub's name and its bootstrap key. Use the fleet
   config **after** `cloudhub create`, which recorded the CloudHub's key in it.
3. **Power on.** If fleet pairing is closed — the usual case — each node is refused,
   keeps its bootstrap key, and waits: that is correct. It pairs in part C.

`scripts/check_node.sh <address>` once a node is up (`jaia_ip h<id>f<fleet>` /
`b<id>f<fleet>` on the fleet Wi-Fi, or its Ethernet address on the bench) confirms its
id, release, units and radios. Record each node.

## C. Final pairing

Start with `scripts/preflight.sh --part C --config fleetN.cfg`; it checks the CloudHub
answers and whether hub 1 can be reached.

1. **Open Fleet Pairing — technician.** CloudHub JCU → Fleet Changes → "Open Fleet
   Pairing", 1 hour. Port 22 on the CloudHub is then open to everyone, so don't leave it.
   `scripts/check_cloudhub.sh <base uri> --ssh` now checks the CloudHub from the inside.
2. **Pair — technician, from a hub's JCU on the fleet Wi-Fi.**
   `http://10.23.<fleet>.11/jcu/` (hub 1) → "Pair Fleet to CloudHub". Nodes that paired at
   first boot report "Already paired"; others pair now. A node whose CloudHub was
   replaced pairs again by itself.
3. **Verify — you.** `scripts/check_node.sh <address> --paired` for every node; the
   CloudHub JCU's "Check CloudHub VPN Status" lists each node's last handshake; JCC at
   `https://run.<base uri>/` shows every hub and bot.
4. **Close Fleet Pairing — technician.** Then `scripts/check_cloudhub.sh <base uri>`
   shows port 22 closed.
5. **Hand-over — technician and customer.** The customer claims `fleet_admin` ("Reset
   password?", emailed to the admin address) and, as `fleet_admin`, deletes
   `jaia_bootstrap` at `https://users.<base uri>` before the CloudHub is shipped. Ask
   before treating this as part of the job; it is often done later.

Finish with the record complete: every node, what's running in AWS (instance,
addresses, VirtualFleet state), and anything left for later.

When something fails, look it up in `references/troubleshooting.md` before trying
anything else.
