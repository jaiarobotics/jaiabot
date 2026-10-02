#!/usr/bin/env python3

"""Tier 3 support access: the WireGuard peer and the nodes' keys, together.

A grant is one record on the CloudHub, and everything else is derived from it by
reconciling. That is what keeps the two halves from drifting apart: a peer with
no key reaches machines it cannot log in to, and a key with no peer is a login
waiting for a tunnel, so neither is ever written or removed on its own. It also
means a bot that was switched off when the grant was made is caught up at the
next reconciliation instead of being quietly left out.

A grant is bounded three ways, each applied on every run rather than once when
it was written: its own expiry, two weeks from when it was made, and the window
the customer approved. Editing a record on the box can only shorten it.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time

MAX_DAYS = 14
SERVER_IFACE = "wg_cloudhub"
PEER_PREFIX = "support"

STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
TIER3_DIR = os.path.join(STATE_DIR, "tier3")
GRANT_FILE = os.path.join(STATE_DIR, "grant.json")
AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")

INVENTORY = os.environ.get("JAIA_INVENTORY", "/etc/jaiabot/inventory.yml")
AUTHORIZED_KEYS = os.environ.get("JAIA_TMP_AUTHORIZED_KEYS",
                                 "/etc/jaiabot/ssh/tmp_authorized_keys")
PEERS = os.environ.get("JAIA_VPN_PEERS", "jaia-vpn-peers.sh")
JAIA_IP = os.environ.get("JAIA_IP", "jaia_ip")
JAIA_BOUNDS = os.environ.get("JAIA_BOUNDS", "jaia_bounds")
SSH = os.environ.get("JAIA_SSH", "ssh")
NODE_USER = "jaia"


def run(command, **kwargs):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                          text=True, **kwargs).stdout.strip()


def fleet_id():
    if "JAIA_FLEET_ID" in os.environ:
        return int(os.environ["JAIA_FLEET_ID"])
    return int(run(["bash", "-c",
                    "source /usr/bin/jaia-debconf.sh; jaia_debconf_get fleet_id"]))


def desktop_addr(desktop):
    return run([JAIA_IP, "--query_type", "addr", "--ip_net", "cloudhub_vpn",
                "--fleet_id", str(fleet_id()), "--node_type", "desktop",
                "--node_id", str(desktop)])


def cloudhub_addr():
    return run([JAIA_IP, "--query_type", "addr", "--ip_net", "cloudhub_vpn",
                "--fleet_id", str(fleet_id()), "--node_type", "hub",
                "--node_id", run([JAIA_BOUNDS, "--cloudhub_id"])])


def audit(action, detail):
    entry = dict(detail)
    entry["action"] = action
    entry["at"] = int(time.time())
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.open(AUDIT_FILE, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600), "a") as f:
        f.write(json.dumps(entry, sort_keys=True) + "\n")


##############
## The grant ##
##############

def record_path(desktop):
    return os.path.join(TIER3_DIR, "{}{}.json".format(PEER_PREFIX, desktop))


def records():
    if not os.path.isdir(TIER3_DIR):
        return {}
    found = {}
    for name in sorted(os.listdir(TIER3_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(TIER3_DIR, name)) as f:
            record = json.load(f)
        found[int(record["desktop"])] = record
    return found


def customer_window(now):
    """What the customer approved. No approval, no tier 3 - the shell on the
    CloudHub that issues one is itself held by that same grant."""
    try:
        with open(GRANT_FILE) as f:
            granted = json.load(f)
    except (OSError, ValueError):
        return 0
    return int(granted.get("expires_at", 0)) if granted.get("expires_at", 0) > now else 0


def effective_expiry(record, now):
    return min(int(record["expires_at"]),
               int(record["granted_at"]) + MAX_DAYS * 86400,
               customer_window(now))


################
## The fleet  ##
################

def nodes():
    """Every bot and hub but this one, from the inventory first boot wrote."""
    try:
        with open(INVENTORY) as f:
            addresses = re.findall(r"ansible_host:\s*(\S+)", f.read())
    except OSError:
        return []
    mine = cloudhub_addr()
    return [address for address in addresses if address != mine]


def on_node(address, command):
    # As jaia: the key that the other nodes accept, and the ssh config naming it,
    # both belong to that user
    return subprocess.run(
        ["sudo", "-u", NODE_USER, SSH, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
         "{}@{}".format(NODE_USER, address), command],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def drop_key_everywhere(blob):
    return push_to_nodes("sudo sed -i '\\|{}|d' {}".format(blob, AUTHORIZED_KEYS))


def set_key_everywhere(line, blob):
    return push_to_nodes(
        "sudo sed -i '\\|{}|d' {}; echo '{}' | sudo tee -a {} > /dev/null"
        .format(blob, AUTHORIZED_KEYS, line, AUTHORIZED_KEYS))


def push_to_nodes(command):
    """A node that is switched off is not an error - the next reconciliation
    catches it up, and until then it has no key to be reached with anyway."""
    missed = [address for address in nodes() if on_node(address, command).returncode != 0]
    if missed:
        print("could not reach: {}".format(", ".join(missed)), file=sys.stderr)
    return missed


#################
## Reconciling ##
#################

def peers():
    listed = run(["sudo", PEERS, "list", SERVER_IFACE])
    return [name for name in listed.split() if name.startswith(PEER_PREFIX)]


def add_peer(record):
    run(["sudo", PEERS, "add", SERVER_IFACE, "{}{}".format(PEER_PREFIX, record["desktop"]),
         record["wg_pubkey"], desktop_addr(record["desktop"]) + "/128"])


def remove_peer(name):
    subprocess.run(["sudo", PEERS, "remove", SERVER_IFACE, name],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def blob_of(ssh_pubkey):
    return ssh_pubkey.split()[1]


def reconcile():
    now = int(time.time())
    live = {}

    approved = customer_window(now)
    for desktop, record in records().items():
        expires = effective_expiry(record, now)
        if expires <= now:
            retire(record, "expired" if approved else "customer ended support access")
            continue
        live[desktop] = record

        line = 'expiry-time="{}" {}'.format(
            time.strftime("%Y%m%d", time.localtime(expires)), record["ssh_pubkey"])
        set_key_everywhere(line, blob_of(record["ssh_pubkey"]))

    held = set(peers())
    for desktop, record in live.items():
        name = "{}{}".format(PEER_PREFIX, desktop)
        if name not in held:
            add_peer(record)

    # A peer with no record behind it reaches a fleet nobody granted it
    for name in held:
        if name not in {"{}{}".format(PEER_PREFIX, d) for d in live}:
            remove_peer(name)

    return live


def retire(record, why):
    drop_key_everywhere(blob_of(record["ssh_pubkey"]))
    remove_peer("{}{}".format(PEER_PREFIX, record["desktop"]))
    try:
        os.unlink(record_path(record["desktop"]))
    except OSError:
        pass
    audit("tier3_end", {"desktop": record["desktop"], "why": why})


##############
## Commands ##
##############

def cmd_grant(args):
    now = int(time.time())
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit("days must be between 1 and {}".format(MAX_DAYS))
    if not customer_window(now):
        sys.exit("the customer has granted no support access to this fleet, so there is "
                 "nothing for this to ride on")
    if len(args.ssh_key.split()) < 2:
        sys.exit("--ssh-key must be a full public key")

    record = {"desktop": args.desktop,
              "wg_pubkey": args.wg_key,
              "ssh_pubkey": args.ssh_key,
              "granted_at": now,
              "expires_at": now + args.days * 86400,
              "granted_by": args.by or os.environ.get("SUDO_USER", "")}

    existing = records().get(args.desktop)
    if existing:
        retire(existing, "replaced")

    os.makedirs(TIER3_DIR, mode=0o700, exist_ok=True)
    with open(os.open(record_path(args.desktop), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600),
              "w") as f:
        json.dump(record, f, sort_keys=True)
        f.write("\n")

    audit("tier3_grant", record)
    reconcile()
    print("support{} reaches fleet {} until {}".format(
        args.desktop, fleet_id(),
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(effective_expiry(record, now)))))


def cmd_revoke(args):
    record = records().get(args.desktop)
    if not record:
        sys.exit("support{} holds no grant".format(args.desktop))
    retire(record, "revoked")
    print("support{} no longer reaches the fleet".format(args.desktop))


def cmd_reconcile(args):
    for desktop, record in sorted(reconcile().items()):
        print("support{} until {}".format(
            desktop, time.strftime("%Y-%m-%d %H:%M UTC",
                                   time.gmtime(effective_expiry(record, int(time.time()))))))


def cmd_list(args):
    now = int(time.time())
    for desktop, record in sorted(records().items()):
        print("support{}\t{}\t{}".format(
            desktop,
            time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(effective_expiry(record, now))),
            record.get("granted_by", "")))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    actions = parser.add_subparsers(dest="action", required=True)

    grant = actions.add_parser("grant", help="grant one support desktop access to the fleet")
    grant.add_argument("--desktop", type=int, required=True, help="support desktop id (1-9)")
    grant.add_argument("--wg-key", required=True, help="its WireGuard public key")
    grant.add_argument("--ssh-key", required=True, help="the SSH public key to authorize")
    grant.add_argument("--days", type=int, default=7)
    grant.add_argument("--by", default="")
    grant.set_defaults(run=cmd_grant)

    revoke = actions.add_parser("revoke", help="end one grant now")
    revoke.add_argument("--desktop", type=int, required=True)
    revoke.set_defaults(run=cmd_revoke)

    actions.add_parser("reconcile", help="bring peers and keys back in line with the grants") \
           .set_defaults(run=cmd_reconcile)
    actions.add_parser("list", help="show the grants in force").set_defaults(run=cmd_list)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
