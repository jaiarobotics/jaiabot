---
name: jaia-fleet-create
description: Build a new 3.y JaiaBot fleet with a CloudHub — fleet config, `jaia admin fleet cloudhub create`, DNS, commissioning account, node boot files and pairing. Use when a technician asks to create, provision or commission a new fleet or CloudHub, to provision a fleet's bots and hubs, or to pair a fleet to its CloudHub, including resuming part way through.
---

# Build a new fleet with a CloudHub

You guide a Jaia technician (in the office, good internet) through building a fleet.
You run what is safe to run; the technician does what needs their hands, their Yubikey
or their own sign-in. Say at each step which it is. This skill is the whole checklist;
it needs no other document.

Three parts, often on different days, people and workstations. **The fleet config
(`fleetN.cfg`) is what joins them**: `fleet create` (A2) writes it, everything else
starts from it. A and B can be done in either order once it exists; C comes last. Ask
for its path, read where the fleet stands from it and from the fleet itself (never from
memory of an earlier session), ask which part is wanted, then run that part's preflight.

| Part | Does | Needs |
| --- | --- | --- |
| **A. CloudHub** | fleet config, CloudHub, DNS, commissioning account | a JaiaBot checkout of the release, the `jaia` tool, `aws login`, a Yubikey per physical hub, access to the DNS provider |
| **B. Nodes** | image and boot files per bot and hub | the `jaia` tool, the fleet config, the SD cards (no AWS, no checkout) |
| **C. Pairing** | every node on the CloudHub VPN, hand-over | a browser signed in as `jaia_bootstrap`, the fleet Wi-Fi, the fleet config (no AWS) |

## Rules

- **Confirm before anything that costs money or can't be undone**: `cloudhub create`,
  `cloudhub delete`, writing an SD card, deleting `jaia_bootstrap`.
- **Never handle the commissioning credentials.** The technician claims `jaia_bootstrap`
  in their own browser; never ask for or store its password or TOTP secret.
- **Never weaken TLS or open SSH yourself.** Port 22 opens only through the JCU's "Open
  Fleet Pairing" (or a customer's support grant). No security-group edits, no `-k`.
- **No hand fixes on CloudHubs or nodes.** Stop, explain, point at
  `references/troubleshooting.md`; a workaround is the technician's call and goes in the record.
- **Fleet configs hold private keys.** `chmod 600`, never print or paste them; show
  settings with `jaia admin fleet validate` or by grepping the field.
- **Keep the record**: `fleet<N>-record.md` next to the config, from
  `references/record-template.md` — what was done, when, and the evidence, after every step.

## Checks

```
scripts/preflight.sh --part A --fleet <N> --region <region> --repo <repo> [--base-uri <name>] [--config fleetN.cfg]
scripts/preflight.sh --part B --config fleetN.cfg
scripts/preflight.sh --part C --config fleetN.cfg
scripts/check_dns.sh <base uri> <CloudHub IPv4> [--wait <s>]     # the zone's own name servers and public resolvers
scripts/check_cloudhub.sh <base uri> [--ip <IPv4>] [--ssh]       # --ip: ignore this workstation's resolver; --ssh: from inside, while pairing is open
scripts/check_node.sh <address> [--paired]                       # jaia_ip h<id>f<N> / b<id>f<N> on the fleet Wi-Fi
scripts/pi_image.sh <repo> [--download <dir>]
```

Preflight FAIL stops the part; explain every WARN. When something fails, look in
`references/troubleshooting.md` before trying anything else.

## A. CloudHub

1. **Preflight.** Ask fleet id, region (`ca-central-1` or `us-east-1` usually), repo
   (`release` for customers; `beta`, `continuous`, `test` otherwise) and base URI (e.g.
   `fleet9.jaia.tech` or a customer domain); run `preflight.sh --part A`. `jaia` must be
   the release's — the package from the same repo, or a build of this checkout, first on
   `PATH` — and preflight warns when it and the AMI differ.

2. **Fleet config — technician's terminal** (dialogs, a Yubikey touch per hub):

   ```
   jaia admin fleet create fleetN.cfg
   ```

   Answers: fleet id; **CloudHub: yes**; hub and bot ids; a Yubikey per physical hub;
   permanent SSH keys (theirs and Jaia's); the fleet Wi-Fi password; **CloudHub VPN at
   boot: yes** (no = paired but tunnels down); base URI; the customer's admin email;
   **"Are you using Jaia SMTP?": yes** unless the customer sends mail through their own
   relay; the customer name (one per customer: the `jaia_customer` AWS tag); comms links
   **only the radios the hardware has** (an XBee that isn't there silences the hub); accept
   the prefilled DCCL and XBee passwords. Never `--simulation` for a real fleet. Then
   `chmod 600 fleetN.cfg` and `preflight.sh --part A … --config fleetN.cfg`, which
   checks it is a real fleet with a CloudHub.

3. **Create the CloudHub — you, once confirmed** (about 5 minutes, from the checkout):

   ```
   jaia admin fleet cloudhub create fleetN.cfg --region <region> --repo <repo> \
       --bootstrap-email <Jaia commissioning address> --output-json cloudhubN.json
   ```

   It records the CloudHub's key in `fleetN.cfg` and prints the DNS records, the SMTP
   note and the account instructions: copy them into the record. Each login to the new
   CloudHub is a touch of the technician's Yubikey (three in all); "Connection refused"
   and "Permission denied" while it waits are expected.

4. **DNS — technician, at the domain's provider.** Exactly the records printed:

   ```
   <name>     A      <IPv4>
   <name>     AAAA   <IPv6>
   *.<name>   CNAME  <base uri>.
   ```

   Then `check_dns.sh <base uri> <IPv4> --wait 1800`. The CloudHub holds its web server
   back until the names resolve to it, so nothing is lost by taking time here.

5. **Certificates.** `check_cloudhub.sh <base uri> --ip <IPv4>` until every site passes,
   usually within two minutes of DNS. If not, see "Let's Encrypt" in troubleshooting.

6. **Commissioning account — technician's browser.** `https://<base uri>` → "Reset
   password?" for `jaia_bootstrap` (mail to the bootstrap address) → password and second
   factor. Every later browser step is as `jaia_bootstrap`.

7. **Optional VirtualFleet.** CloudHub JCU (`https://run.<base uri>/jcu/`) → VirtualFleet →
   "(Re)create VirtualFleet machines"; stop it afterwards so it doesn't run up cost.

8. **Every site — technician, with you.** Run (JCC), JCU, JDV, Sim, Users, Support,
   Account. JCC must show **HUB Cloud** with no "Connection to Hub Dropped" banner (if it
   does: `check_cloudhub.sh … --ssh` during a pairing window, step C1).

Done when DNS, certificates and the sites pass and `jaia_bootstrap` is claimed. Tell the
technician the config **as `cloudhub create` left it** is what B (ideally) and C need.

## B. Nodes

`preflight.sh --part B --config fleetN.cfg`. B needs the config from A2, not the
CloudHub: before A3 it warns that the config holds no CloudHub key yet, and so does
`generate`. Such a node boots and pairs normally; it only refuses SSH from the CloudHub
(playbooks run from the CloudHub's JCU) until a hub whose stored config holds the key
runs "Pair new hub" from its JCU. So when B comes first, keep one hub's card for after
A, or regenerate it then. Per node:

1. **Image — technician.** `pi_image.sh <repo>` names the current Raspberry Pi image for
   the CloudHub's repo (`--download <dir>` fetches it); they write it with Raspberry Pi
   Imager or `gunzip -c … | sudo dd of=/dev/<card> bs=4M status=progress`. Confirm the
   device before anything writes to it.
2. **Boot files — you**, with the card's boot partition mounted:
   `jaia admin fleet generate fleetN.cfg <hub|bot> <id>` (or `--bootdir`). It writes the
   node's keys, first-boot settings, the CloudHub's name, the bootstrap key and, when the
   config has it, the CloudHub's key.
3. **Power on.** With pairing closed (the usual case) the node is refused, keeps its
   bootstrap key and waits; that is correct.

`check_node.sh <address>` once it is up confirms id, release, units and radios (it
waits up to two minutes for the first health report). Record each node.

## C. Pairing

`preflight.sh --part C --config fleetN.cfg`.

1. **Open Fleet Pairing — technician.** CloudHub JCU → Fleet Changes → "Open Fleet
   Pairing", 1 hour: port 22 is then open to everyone, so don't leave it.
2. **Pair — technician**, from hub 1's JCU on the fleet Wi-Fi
   (`http://10.23.<N>.11/jcu/`) → "Pair Fleet to CloudHub". "Already paired" is fine.
3. **Verify — you.** `check_node.sh <address> --paired` per node; CloudHub JCU → "Check
   CloudHub VPN Status" lists each handshake; JCC at `https://run.<base uri>/` shows every node.
4. **Close Fleet Pairing — technician.** `check_cloudhub.sh <base uri>` then shows port 22 closed.
5. **Hand-over — customer.** They claim `fleet_admin` ("Reset password?", to the admin
   email) and, as `fleet_admin`, delete `jaia_bootstrap` at `https://users.<base uri>`
   before the CloudHub ships. Ask before treating this as part of the job.

Finish the record: every node, what runs in AWS (instance, addresses, VirtualFleet),
and anything left for later.
