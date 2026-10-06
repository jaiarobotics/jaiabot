#!/usr/bin/env python3

"""Support access on the CloudHub: what is granted, and everything it implies.

A grant is a record. The directory group that lets Jaia onto this machine, the
WireGuard peer that carries it into the fleet and the tmp_authorized_keys line
on every bot and hub are all derived from one by reconciling, never set on their
own. That is what keeps them from drifting apart - a peer with no key reaches
machines it cannot log in to, a key with no peer is a login waiting for a
tunnel, and group membership left behind is standing access of exactly the kind
this design exists to end. It also means a bot that was switched off when the
grant was made is caught up at the next reconciliation rather than left out.

Every bound is applied on each run rather than once when the record was written:
a grant's own expiry, two weeks from when it was made, and - for tier 3 - the
window the customer approved. So a record edited on this machine can only ever
shorten access, never extend it.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

MAX_DAYS = 14
ACCOUNT = "jaia_support"
GROUP = "jaia_support"
SERVER_IFACE = "wg_cloudhub"
PEER_PREFIX = "support"

STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
TIER3_DIR = os.path.join(STATE_DIR, "tier3")
GRANT_FILE = os.path.join(STATE_DIR, "grant.json")
AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")
LAST_RUN_FILE = os.path.join(STATE_DIR, "last-reconcile")

SECRETS = os.environ.get("JAIA_AUTH_SECRETS", "/var/log/jaiabot/auth/authelia/secrets")
LLDAP_URL = os.environ.get("JAIA_LLDAP_URL", "http://127.0.0.1:17170")

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


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_json(path, payload):
    pending = path + ".new"
    with open(os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f:
        json.dump(payload, f, sort_keys=True)
        f.write("\n")
    os.replace(pending, path)


###########
## LLDAP ##
###########

# Loopback only, so nothing on the way sees the admin password or the answer
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def lldap_post(path, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(LLDAP_URL + path, data=json.dumps(payload).encode(),
                                     headers=headers, method="POST")
    with _opener.open(request, timeout=15) as answer:
        return json.loads(answer.read().decode())


def lldap_login():
    """Logs in as the directory's own service account, not jaia_admin: jaia_admin is
    a person's login whose password the customer may change, and a login that breaks
    when they do would take support access with it."""
    with open(SECRETS) as f:
        held = dict(line.strip().split("=", 1) for line in f if "=" in line)
    password = held.get("authelia_ldap_password")
    if not password:
        raise RuntimeError("no authelia_ldap_password in {}".format(SECRETS))
    return lldap_post("/auth/simple/login",
                      {"username": "authelia", "password": password})["token"]


def graphql(token, query, variables):
    answer = lldap_post("/api/graphql", {"query": query, "variables": variables}, token)
    if answer.get("errors"):
        raise RuntimeError(answer["errors"][0].get("message", "LLDAP refused the request"))
    return answer["data"]


def in_support_group(token):
    groups = graphql(token,
                     "query($user: String!) { user(userId: $user) { groups { displayName } } }",
                     {"user": ACCOUNT})["user"]["groups"]
    return any(group["displayName"] == GROUP for group in groups)


def support_group_id(token):
    for group in graphql(token, "query { groups { id displayName } }", {})["groups"]:
        if group["displayName"] == GROUP:
            return group["id"]
    raise RuntimeError("LLDAP has no '{}' group".format(GROUP))


def set_membership(member):
    token = lldap_login()
    if in_support_group(token) == member:
        return
    mutation = ("mutation($user: String!, $group: Int!) "
                "{ addUserToGroup(userId: $user, groupId: $group) { ok } }" if member else
                "mutation($user: String!, $group: Int!) "
                "{ removeUserFromGroup(userId: $user, groupId: $group) { ok } }")
    graphql(token, mutation, {"user": ACCOUNT, "group": support_group_id(token)})


############
## Tier 2 ##
############

def tier2_window(now):
    """What the customer approved, as this machine is entitled to read it: the
    cap is applied here and not taken from the record."""
    granted = read_json(GRANT_FILE)
    if not granted:
        return 0
    expires = min(int(granted.get("expires_at", 0)),
                  int(granted.get("approved_at", 0)) + MAX_DAYS * 86400)
    return expires if expires > now else 0


############
## Tier 3 ##
############

def record_path(desktop):
    return os.path.join(TIER3_DIR, "{}{}.json".format(PEER_PREFIX, desktop))


def records():
    if not os.path.isdir(TIER3_DIR):
        return {}
    found = {}
    for name in sorted(os.listdir(TIER3_DIR)):
        if name.endswith(".json"):
            record = read_json(os.path.join(TIER3_DIR, name))
            if record:
                found[int(record["desktop"])] = record
    return found


def tier3_expiry(record, approved, now):
    return min(int(record["expires_at"]),
               int(record["granted_at"]) + MAX_DAYS * 86400,
               approved)


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
    # As jaia: the key the other nodes accept, and the ssh config naming it,
    # both belong to that user
    return subprocess.run(
        ["sudo", "-u", NODE_USER, SSH, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
         "{}@{}".format(NODE_USER, address), command],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def push_to_nodes(command):
    """A node that is switched off is not an error - the next reconciliation
    catches it up, and until then it has no key to be reached with anyway."""
    missed = [address for address in nodes() if on_node(address, command).returncode != 0]
    if missed:
        print("could not reach: {}".format(", ".join(missed)), file=sys.stderr)
    return missed


def drop_key_everywhere(blob):
    return push_to_nodes("sudo sed -i '\\|{}|d' {}".format(blob, AUTHORIZED_KEYS))


def set_key_everywhere(line, blob):
    return push_to_nodes(
        "sudo sed -i '\\|{}|d' {}; echo '{}' | sudo tee -a {} > /dev/null"
        .format(blob, AUTHORIZED_KEYS, line, AUTHORIZED_KEYS))


def peers():
    listed = run(["sudo", PEERS, "list", SERVER_IFACE])
    return [name for name in listed.split() if name.startswith(PEER_PREFIX)]


def blob_of(ssh_pubkey):
    return ssh_pubkey.split()[1]


def retire(record, why):
    drop_key_everywhere(blob_of(record["ssh_pubkey"]))
    subprocess.run(["sudo", PEERS, "remove", SERVER_IFACE,
                    "{}{}".format(PEER_PREFIX, record["desktop"])],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        os.unlink(record_path(record["desktop"]))
    except OSError:
        pass
    audit("tier3_end", {"desktop": record["desktop"], "why": why})


#################
## Reconciling ##
#################

def reconcile():
    now = int(time.time())

    approved = tier2_window(now)
    if not approved and os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
        audit("tier2_end", {"why": "expired"})

    # Expiry is the whole point of this run, and the peers and keys below do not
    # need the directory, so a directory that is down delays the group alone
    directory_trouble = None
    try:
        set_membership(bool(approved))
    except Exception as problem:
        directory_trouble = problem
        print("could not reach the user directory: {}".format(problem), file=sys.stderr)

    live = {}
    for desktop, record in records().items():
        expires = tier3_expiry(record, approved, now)
        if expires <= now:
            retire(record, "expired" if approved else "customer ended support access")
            continue
        live[desktop] = record

        line = 'expiry-time="{}" {}'.format(
            time.strftime("%Y%m%d", time.localtime(expires)), record["ssh_pubkey"])
        set_key_everywhere(line, blob_of(record["ssh_pubkey"]))

    held = set(peers())
    wanted = {"{}{}".format(PEER_PREFIX, desktop) for desktop in live}
    for desktop in live:
        name = "{}{}".format(PEER_PREFIX, desktop)
        if name not in held:
            run(["sudo", PEERS, "add", SERVER_IFACE, name, live[desktop]["wg_pubkey"],
                 desktop_addr(desktop) + "/128"])

    # A peer with no record behind it reaches a fleet nobody granted it
    for name in held - wanted:
        subprocess.run(["sudo", PEERS, "remove", SERVER_IFACE, name],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LAST_RUN_FILE, "w") as f:
        f.write("{}\n".format(now))

    if directory_trouble:
        sys.exit("could not reach the user directory: {}".format(directory_trouble))
    return approved, live


##############
## Commands ##
##############

def cmd_approve(args):
    now = int(time.time())
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit("days must be between 1 and {}".format(MAX_DAYS))

    granted = {"fleet": args.fleet, "days": args.days, "reason": args.reason,
               "approved_at": now, "approved_by": args.by, "signer": args.signer,
               "expires_at": now + args.days * 86400}
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    set_membership(True)
    write_json(GRANT_FILE, granted)
    audit("tier2_grant", granted)
    print(granted["expires_at"])


def cmd_revoke(args):
    set_membership(False)
    for record in records().values():
        retire(record, "customer ended support access")
    if os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
    audit("tier2_end", {"why": "revoked", "revoked_by": args.by})


def cmd_grant(args):
    now = int(time.time())
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit("days must be between 1 and {}".format(MAX_DAYS))
    if not tier2_window(now):
        sys.exit("the customer has granted no support access to this fleet, so there is "
                 "nothing for this to ride on")
    # The key is interpolated into a shell command on every node, so it is held
    # to the shape of an authorized_keys line rather than merely split
    if not re.fullmatch(r"[A-Za-z0-9@.-]+ [A-Za-z0-9+/=]+( [^\s'\"]+)?", args.ssh_key):
        sys.exit("--ssh-key must be a bare public key: '<type> <key> [comment]'")
    if not 1 <= args.desktop <= 9:
        sys.exit("--desktop must be between 1 and 9")

    record = {"desktop": args.desktop, "wg_pubkey": args.wg_key, "ssh_pubkey": args.ssh_key,
              "granted_at": now, "expires_at": now + args.days * 86400,
              "granted_by": args.by or os.environ.get("SUDO_USER", "")}

    existing = records().get(args.desktop)
    if existing:
        retire(existing, "replaced")

    os.makedirs(TIER3_DIR, mode=0o700, exist_ok=True)
    write_json(record_path(args.desktop), record)
    audit("tier3_grant", record)

    approved, live = reconcile()
    if args.desktop not in live:
        sys.exit("the grant did not survive reconciliation")
    print("support{} reaches fleet {} until {}".format(
        args.desktop, fleet_id(),
        time.strftime("%Y-%m-%d %H:%M UTC",
                      time.gmtime(tier3_expiry(record, approved, now)))))


def cmd_end(args):
    record = records().get(args.desktop)
    if not record:
        sys.exit("support{} holds no grant".format(args.desktop))
    retire(record, "ended by Jaia")
    print("support{} no longer reaches the fleet".format(args.desktop))


def cmd_reconcile(args):
    approved, live = reconcile()
    for desktop in sorted(live):
        print("support{} until {}".format(
            desktop, time.strftime("%Y-%m-%d %H:%M UTC",
                                   time.gmtime(tier3_expiry(live[desktop], approved,
                                                            int(time.time()))))))


def cmd_status(args):
    """What the support page reads. Membership is asked of LLDAP rather than
    assumed from the record, so a group edited by hand shows up as itself."""
    now = int(time.time())
    state = {"fleet": fleet_id(), "grant": read_json(GRANT_FILE), "tier3": [],
             "last_reconcile": None, "trouble": ""}

    approved = tier2_window(now)
    for desktop, record in sorted(records().items()):
        state["tier3"].append({"desktop": desktop,
                               "expires_at": tier3_expiry(record, approved, now),
                               "granted_by": record.get("granted_by", "")})
    try:
        with open(LAST_RUN_FILE) as f:
            state["last_reconcile"] = int(f.read().strip())
    except (OSError, ValueError):
        pass
    try:
        state["member"] = in_support_group(lldap_login())
    except Exception as problem:
        state["member"] = False
        state["trouble"] = str(problem)

    print(json.dumps(state))


def cmd_list(args):
    now = int(time.time())
    approved = tier2_window(now)
    print("tier 2 until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "- (none)"))
    for desktop, record in sorted(records().items()):
        print("support{}\t{}\t{}".format(
            desktop,
            time.strftime("%Y-%m-%d %H:%M UTC",
                          time.gmtime(tier3_expiry(record, approved, now))),
            record.get("granted_by", "")))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    actions = parser.add_subparsers(dest="action", required=True)

    approve = actions.add_parser("approve", help="record the customer's approval (tier 2)")
    approve.add_argument("--fleet", type=int, required=True)
    approve.add_argument("--days", type=int, required=True)
    approve.add_argument("--reason", default="")
    approve.add_argument("--by", default="")
    approve.add_argument("--signer", default="")
    approve.set_defaults(run=cmd_approve)

    revoke = actions.add_parser("revoke", help="end the customer's approval and all it carries")
    revoke.add_argument("--by", default="")
    revoke.set_defaults(run=cmd_revoke)

    grant = actions.add_parser("grant", help="let one support desktop reach the fleet (tier 3)")
    grant.add_argument("--desktop", type=int, required=True, help="support desktop id (1-9)")
    grant.add_argument("--wg-key", required=True, help="its WireGuard public key")
    grant.add_argument("--ssh-key", required=True, help="the SSH public key to authorize")
    grant.add_argument("--days", type=int, default=7)
    grant.add_argument("--by", default="")
    grant.set_defaults(run=cmd_grant)

    end = actions.add_parser("end", help="end one tier 3 grant now")
    end.add_argument("--desktop", type=int, required=True)
    end.set_defaults(run=cmd_end)

    actions.add_parser("reconcile", help="bring the group, the peers and the keys back in line") \
           .set_defaults(run=cmd_reconcile)
    actions.add_parser("status", help="print what is granted, as JSON") \
           .set_defaults(run=cmd_status)
    actions.add_parser("list", help="show the grants in force").set_defaults(run=cmd_list)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
