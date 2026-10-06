#!/usr/bin/env python3

"""Support access on the CloudHub: what the customer granted, and when it ends.

A grant is a record. The directory group that lets Jaia onto this machine is
derived from it by reconciling rather than set on its own, so a membership left
behind - standing access of exactly the kind this design exists to end - is
corrected on the next run instead of persisting.

Reaching the fleet is not a second grant: the CloudHub is the way in, and bots
and hubs are reached onward from the shell it gives, with the tooling that
already does that.

Every bound is applied on each run rather than once when the record was written:
the grant's own expiry, and two weeks from when it was made. So a record edited
on this machine can only ever shorten access, never extend it.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

MAX_DAYS = 14
ACCOUNT = "jaia_support"
GROUP = "jaia_support"

STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
GRANT_FILE = os.path.join(STATE_DIR, "grant.json")
AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")
LAST_RUN_FILE = os.path.join(STATE_DIR, "last-reconcile")

SECRETS = os.environ.get("JAIA_AUTH_SECRETS", "/var/log/jaiabot/auth/authelia/secrets")
LLDAP_URL = os.environ.get("JAIA_LLDAP_URL", "http://127.0.0.1:17170")


def run(command, **kwargs):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                          text=True, **kwargs).stdout.strip()


def fleet_id():
    if "JAIA_FLEET_ID" in os.environ:
        return int(os.environ["JAIA_FLEET_ID"])
    return int(run(["bash", "-c",
                    "source /usr/bin/jaia-debconf.sh; jaia_debconf_get fleet_id"]))


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


###############
## The grant ##
###############

def grant_window(now):
    """What the customer approved, as this machine is entitled to read it: the
    cap is applied here and not taken from the record."""
    granted = read_json(GRANT_FILE)
    if not granted:
        return 0
    expires = min(int(granted.get("expires_at", 0)),
                  int(granted.get("approved_at", 0)) + MAX_DAYS * 86400)
    return expires if expires > now else 0


#################
## Reconciling ##
#################

def reconcile():
    now = int(time.time())

    approved = grant_window(now)
    if not approved and os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
        audit("end", {"why": "expired"})

    set_membership(bool(approved))

    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LAST_RUN_FILE, "w") as f:
        f.write("{}\n".format(now))
    return approved


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
    audit("grant", granted)
    print(granted["expires_at"])


def cmd_revoke(args):
    set_membership(False)
    if os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
    audit("end", {"why": "revoked", "revoked_by": args.by})


def cmd_reconcile(args):
    try:
        approved = reconcile()
    except Exception as problem:
        sys.exit("could not reach the user directory: {}".format(problem))
    print("until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "- (none)"))


def cmd_status(args):
    """What the support page reads. Membership is asked of LLDAP rather than
    assumed from the record, so a group edited by hand shows up as itself."""
    state = {"fleet": fleet_id(), "grant": read_json(GRANT_FILE),
             "last_reconcile": None, "trouble": ""}

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
    approved = grant_window(int(time.time()))
    print("granted until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "- (none)"))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    actions = parser.add_subparsers(dest="action", required=True)

    approve = actions.add_parser("approve", help="record the customer's approval")
    approve.add_argument("--fleet", type=int, required=True)
    approve.add_argument("--days", type=int, required=True)
    approve.add_argument("--reason", default="")
    approve.add_argument("--by", default="")
    approve.add_argument("--signer", default="")
    approve.set_defaults(run=cmd_approve)

    revoke = actions.add_parser("revoke", help="end the customer's approval")
    revoke.add_argument("--by", default="")
    revoke.set_defaults(run=cmd_revoke)

    actions.add_parser("reconcile", help="bring the group back in line with the grant") \
           .set_defaults(run=cmd_reconcile)
    actions.add_parser("status", help="print what is granted, as JSON") \
           .set_defaults(run=cmd_status)
    actions.add_parser("list", help="show the grant in force").set_defaults(run=cmd_list)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
