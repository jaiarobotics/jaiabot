# New fleet with a CloudHub (3.y) — checklist

For a technician, with or without Claude. Three parts; A and B in either order once
`fleetN.cfg` exists, C last. Keep a record (`record-template.md`) as you go. The
`scripts/` next to this file are optional helpers; each step says the check by hand.

Rules: `fleetN.cfg` holds private keys — `chmod 600`, never paste it anywhere. Port 22
on a CloudHub opens only through the JCU's "Open Fleet Pairing". No hand fixes on
CloudHubs or nodes; a workaround is your call and goes in the record.

## A. CloudHub

Needs: a JaiaBot checkout of the release; its `jaia` tool first on `PATH` (the package
from the same repo, or a build of that checkout); `aws login`; a Yubikey per physical
hub (`ykman`); access to the domain's DNS.

1. **Choose**: fleet id (unused in the region), region (`ca-central-1` / `us-east-1`),
   repo (`release` for customers), base URI (`fleetN.jaia.tech` or a customer domain).
   Check: `aws ec2 describe-vpcs --region <r> --filters Name=tag:jaia_fleet,Values=<N>`
   is empty; a `<repo>/3.y` AMI exists in the region (`scripts/preflight.sh --part A`).
2. **Fleet config**: `jaia admin fleet create fleetN.cfg`. Answers: fleet id; CloudHub
   **yes**; hub and bot ids; a Yubikey per hub; permanent SSH keys (yours and Jaia's);
   fleet Wi-Fi password; CloudHub VPN at boot **yes**; base URI; customer admin email;
   "Are you using Jaia SMTP?" **yes** unless the customer has their own relay; customer
   name (one per customer); comms links **only radios the hardware has**; accept the
   prefilled DCCL and XBee passwords. Never `--simulation` for a real fleet. Then
   `chmod 600 fleetN.cfg`; `jaia admin fleet validate fleetN.cfg`; confirm it says
   `fleet_type: FLEET_TYPE_REAL`, `hubs: 30` and has a `cloudhub {` block
   (`scripts/preflight.sh --part A … --config fleetN.cfg`).
3. **Create the CloudHub** (from the checkout, ~5 min; costs money):
   ```
   jaia admin fleet cloudhub create fleetN.cfg --region <r> --repo <repo> \
       --bootstrap-email <Jaia commissioning address> --output-json cloudhubN.json
   ```
   Three Yubikey touches while it logs in; "Connection refused"/"Permission denied"
   while it waits are normal. It records the CloudHub's key in `fleetN.cfg` and prints
   the DNS records, the SMTP note and the account steps: copy them into the record.
4. **DNS** at the domain's provider, exactly as printed:
   ```
   <name>     A      <IPv4>
   <name>     AAAA   <IPv6>
   *.<name>   CNAME  <base uri>.
   ```
   Check: `dig @<zone name server> <base uri> A` and `dig … run.<base uri> A` give the
   IPv4 (`scripts/check_dns.sh <base uri> <IPv4> --wait 1800`). The CloudHub's web
   server waits for this, so take your time.
5. **Certificates**: within ~2 min of DNS, `curl -sS -o /dev/null -w '%{http_code}\n'
   --resolve <site>:443:<IPv4> https://<site>/` is 200 or 302 for `<base uri>` and
   `run.`, `auth.`, `users.`, `support.` (502 from `sim.` is fine with no VirtualFleet)
   (`scripts/check_cloudhub.sh <base uri> --ip <IPv4>`). Port 22 must be closed
   (`nc -z <IPv4> 22` fails).
6. **Commissioning account**: `https://<base uri>` → "Reset password?" for
   `jaia_bootstrap` (mail to the bootstrap address) → password and second factor.
7. **Optional VirtualFleet**: CloudHub JCU (`https://run.<base uri>/jcu/`) → VirtualFleet
   → "(Re)create VirtualFleet machines"; stop it afterwards (it costs while running).
8. **Every site** as `jaia_bootstrap`: Run (JCC), JCU, JDV, Sim, Users, Support,
   Account. JCC shows **HUB Cloud** with no "Connection to Hub Dropped" banner.

Done: DNS, certificates and sites pass, `jaia_bootstrap` claimed. Keep `fleetN.cfg` as
`cloudhub create` left it: B and C need it.

## B. Nodes

Needs: the `jaia` tool, `fleetN.cfg`, the SD cards. No AWS, no checkout. Before A3 the
config holds no CloudHub key: nodes made from it boot and pair, but refuse SSH from the
CloudHub (its JCU playbooks) until "Pair new hub" runs after A from a hub whose stored
config has the key — so keep one hub's card for after A, or regenerate it then.

Per bot and hub:

1. **Image**: the current Raspberry Pi image for the CloudHub's repo
   (`scripts/pi_image.sh <repo> [--download <dir>]`), written with Raspberry Pi Imager or
   `gunzip -c <image> | sudo dd of=/dev/<card> bs=4M status=progress`. Check the device.
2. **Boot files**, with the card's boot partition mounted:
   `jaia admin fleet generate fleetN.cfg <hub|bot> <id>` (`--bootdir` if not found).
3. **Power on.** With pairing closed the node is refused and keeps its bootstrap key:
   correct; it pairs in C.

Check (on the node, `ssh jaia@<address>`; `jaia_ip h<id>f<N>` / `b<id>f<N>` on the fleet
Wi-Fi): `/etc/jaiabot/jaia.env` has the right type, id and fleet; `systemctl list-units
'jaiabot*'` all active; a hub shows itself in `curl -s -X POST -H 'Content-Type:
application/json' -d '{"target":{"all":true},"status":true}' http://localhost/jaia/v1`
after a minute or two (`scripts/check_node.sh <address>`).

## C. Pairing

Needs: a browser as `jaia_bootstrap`, the fleet Wi-Fi, `fleetN.cfg` with the CloudHub's
key. No AWS.

1. **Open Fleet Pairing**: CloudHub JCU → Fleet Changes → "Open Fleet Pairing", 1 hour.
   Port 22 is open to everyone meanwhile: don't leave it open.
2. **Pair**: hub 1's JCU on the fleet Wi-Fi (`http://10.23.<N>.11/jcu/`) → "Pair Fleet
   to CloudHub". "Already paired" is fine.
3. **Verify**: CloudHub JCU → "Check CloudHub VPN Status" lists every node's handshake;
   JCC at `https://run.<base uri>/` shows every hub and bot; on each node
   `sudo wg show` has a recent handshake (`scripts/check_node.sh <address> --paired`).
4. **Close Fleet Pairing**; `nc -z <IPv4> 22` fails again.
5. **Hand-over** (customer, often later): claim `fleet_admin` ("Reset password?", to
   the admin email), then as `fleet_admin` delete `jaia_bootstrap` at
   `https://users.<base uri>` before the CloudHub ships.

Finish the record: every node, what runs in AWS (instance, addresses, VirtualFleet),
anything left for later. Problems: `troubleshooting.md`.
