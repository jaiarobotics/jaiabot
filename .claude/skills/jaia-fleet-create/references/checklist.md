# New fleet with a CloudHub (3.y) — checklist

For a technician, with or without Claude. Three parts; A and B in either order once
`fleetN.cfg` exists, C last. Keep a record (`record-template.md`) as you go.

Rules: `fleetN.cfg` holds private keys — `chmod 600`, never paste it anywhere. Port 22
on a CloudHub opens only through the JCU's "Open Fleet Pairing". No hand fixes on
CloudHubs or nodes; a workaround is your call and goes in the record.

## A. CloudHub

Needs: a JaiaBot checkout of the release; its `jaia` tool first on `PATH` (the package
from the same repo, or a build of that checkout); `aws login`; a Yubikey per physical
hub; access to the domain's DNS.

1. **Choose**: fleet id (not in use in the region), region (`ca-central-1`, `us-east-1`
   or `us-gov-east-1`), repo (`release` for customers), base URI (`fleetN.jaia.tech` or
   a customer domain). The region must have a `<repo>/3.y` CloudHub image.
2. **Fleet config**: `jaia admin fleet create fleetN.cfg`. Answers: fleet id; CloudHub
   **yes**; hub and bot ids; a Yubikey per hub; permanent SSH keys (yours and Jaia's);
   fleet Wi-Fi password; CloudHub VPN at boot **yes**; base URI; customer admin email;
   "Are you using Jaia SMTP?" **yes** unless the customer has their own relay; customer
   name (one per customer); comms links **only radios the hardware has**; accept the
   prefilled DCCL and XBee passwords. Never `--simulation` for a real fleet. Then
   `chmod 600 fleetN.cfg` and `jaia admin fleet validate fleetN.cfg`; it must be a real
   fleet with hub 30 and a `cloudhub` block.
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
   Wait until the names resolve to the CloudHub. Its web server waits for this, so
   take your time.
5. **Certificates**: within ~2 min of DNS, `https://<base uri>`, `run.`, `auth.`,
   `users.` and `support.` load in a browser with a valid certificate (`sim.` says the
   VirtualFleet isn't running: fine).
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

1. **Image**: the current Raspberry Pi image for the CloudHub's repo, written with
   Raspberry Pi Imager. Check the device before writing.
2. **Boot files**, with the card's boot partition mounted:
   `jaia admin fleet generate fleetN.cfg <hub|bot> <id>` (`--bootdir` if not found).
3. **Power on.** With pairing closed the node is refused and keeps its bootstrap key:
   correct; it pairs in C.

Check, a minute or two after boot: the node's JCU (`http://<address>/jcu/`) shows the
right type, id and fleet, and a hub's JCC (`http://<address>/`) shows the hub itself.

## C. Pairing

Needs: a browser as `jaia_bootstrap`, the fleet Wi-Fi, `fleetN.cfg` with the CloudHub's
key. No AWS.

1. **Open Fleet Pairing**: CloudHub JCU → Fleet Changes → "Open Fleet Pairing", 1 hour.
   Port 22 is open to everyone meanwhile: don't leave it open.
2. **Pair**: hub 1's JCU on the fleet Wi-Fi (`http://10.23.<N>.11/jcu/`) → "Pair Fleet
   to CloudHub". "Already paired" is fine.
3. **Verify**: CloudHub JCU → "Check CloudHub VPN Status" lists every node's handshake;
   JCC at `https://run.<base uri>/` shows every hub and bot.
4. **Close Fleet Pairing.**
5. **Hand-over** (customer, often later): claim `fleet_admin` ("Reset password?", to
   the admin email), then as `fleet_admin` delete `jaia_bootstrap` at
   `https://users.<base uri>` before the CloudHub ships.

Finish the record: every node, what runs in AWS (instance, addresses, VirtualFleet),
anything left for later. Problems: `troubleshooting.md`.
