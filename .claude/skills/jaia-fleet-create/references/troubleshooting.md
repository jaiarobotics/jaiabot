# Troubleshooting a new fleet

Each entry was seen building real fleets. Find the symptom, confirm the cause with the
check given, then do the fix — and record both.

## preflight / `cloudhub create`

**"session has expired. Please reauthenticate using 'aws login'"** — the technician
runs `aws login` (and `aws login --profile <p>` if a profile is used). Nothing was
created; start the step again.

**`cloudhub delete`/`create` say "unrecognized arguments"** — an older `jaia` is first
on `PATH` (e.g. a stale build in another checkout). `command -v jaia` and `jaia version`;
use the release's.

**"fleet N already has a VPC"** — that fleet id is in use in the region. Pick another,
or, if it is a fleet being rebuilt and the technician confirms, `jaia admin fleet
cloudhub delete N --region <r> --customer <c> -y` first. `delete` releases every Elastic
IP tagged with the fleet, so keep any address that must survive untagged.

## DNS

**`check_dns.sh` passes on public resolvers but the workstation can't reach the site** —
a router or local resolver cached the earlier "no such name". It clears within the
record's TTL (often 30 min). Harmless; the CloudHub and the fleet use public DNS.

**Apex right, `run.`/`auth.` wrong** — the wildcard is missing, or points at a name with
no address (a typo in the CNAME target). It must be `*.<name>  CNAME  <base uri>.`

**The provider shows the record but the zone's name servers don't** — still being
published, or added to the wrong zone (e.g. under a different domain at the same
registrar). `dig @<zone name server> <base uri>`.

## Certificates

**Some or all sites have no certificate, and DNS is right** — Let's Encrypt allows 50
new certificates per registered domain per week, and each CloudHub takes about six.
Many CloudHubs under one domain in a week (testing) hits it. On the CloudHub
(`check_cloudhub.sh --ssh` during a pairing window, or `journalctl -u caddy`): "429
rateLimited … retry after <time>". Nothing to do but wait for that time; Caddy retries
by itself. Use a different domain for test fleets.

## The CloudHub's sites

**JCC shows "Connection to Hub Dropped" and no HUB Cloud** — the CloudHub's REST API
isn't loading. `check_cloudhub.sh --ssh` reports it; `/var/log/apache2/error.log` says
why. On releases before SW-2677 it was a stale `key {}` block in
`/etc/jaiabot/rest_api.pb.cfg`: stop and report rather than editing it.

**`check_cloudhub.sh --ssh` says the host key is not the one recorded** — this
workstation has seen an earlier CloudHub under the same name. If the CloudHub was
rebuilt, `ssh-keygen -R <base uri>` and run it again; if it wasn't, stop: something
else is answering for the CloudHub's name.

**A JCU settings playbook (e.g. Comms Links) shows no result and the JCU is 503 for a
minute or two** — the reconfigure it runs stops the JCU's own service, which ends the
playbook. From SW-2686 the node starts its services again by itself; check it with
`check_node.sh` rather than running the playbook again.

**Sim says the VirtualFleet isn't running** — expected until one is created (part A,
step 7).

**Password-reset email doesn't arrive** — the SMTP credentials parameter is missing or
wrong in the region (`preflight.sh` warns), or the provider hasn't verified the sender.

## Nodes

**A hub serves JCC but shows nothing; its JCC has no hub** — every app on it is held
silent. Usually a configured radio that isn't fitted: the fleet config says XBee, the
hub has none, and `goby_intervehicle_portal` never finishes starting
(`check_node.sh` reports the timeouts). Fix the config's comms links and the node's
setting (`jaia admin debconf set --question comms_links --value wifi`, or the JCU's
"Comms Links"), then restart jaiabot.

**A hub's JCU answers 503 after a settings change** — on releases before SW-2686, a
debconf change stopped `jaiabot_goby_liaison_standalone` (the JCU), `jaiabot_dns` and
`jaiabot_update_ufw_rules` without starting them again. `sudo systemctl start` them.

**`jaia admin debconf set` says "could not set … unable to initialize frontend"** — on
releases before SW-2683, over SSH without a terminal. The value was saved but not
applied; run it again with `sudo env DEBIAN_FRONTEND=noninteractive`.

**A node logs "did not accept … for pairing: is fleet pairing open on its JCU?"** at
first boot — fleet pairing was closed, which is normal in part B. It kept its bootstrap
key; it pairs in part C.

## Pairing

**"Pair Fleet to CloudHub" reports a node "Unreachable"** — the JCU reaches nodes over
the fleet Wi-Fi (`10.23.<fleet>.x`). Is the node on it? A bench hub with its Wi-Fi down
can't be reached even by its own JCU.

**A node says "Already paired" but its tunnel doesn't reach the CloudHub** — on releases
before SW-2684 a node paired with an earlier CloudHub of the same name couldn't pair
again. From SW-2684 it pairs again by itself when its tunnel has gone quiet for 5
minutes; run "Pair Fleet to CloudHub" again after waiting.

**Pairing fails with an SSH host key message** — the node recorded an earlier CloudHub's
host key under this name. From SW-2687 a re-pair replaces it; before that,
`sudo ssh-keygen -f /root/.ssh/known_hosts -R <base uri>` on the node.

**Paired, but the tunnel is down** — the fleet config answered "start by itself at
boot?" with no. Change it with `jaia admin fleet edit`, regenerate, or start the tunnel
from each hub's JCU ("Change CloudHub VPN State").

**Hubs don't see each other / JCC on the CloudHub lacks a hub** — `check_node.sh
--paired` on that hub; "UDP 32000 not bound" means the intervehicle portal started
before the tunnel. Restarting jaiabot on the hub binds it.

## Known and harmless

A fresh CloudHub has three failed units: `grub-initrd-fallback`, `grub2-common`,
`jaiabot_update_ufw_rules`. `create --test-keys` prints its warning twice. An unpaired
node shows `wg-quick@wg_jaia_ch<N>` as failed until it pairs.
