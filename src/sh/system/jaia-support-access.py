#!/usr/bin/env python3

"""Support access on the CloudHub: what the customer granted, and when it ends.

A grant is a record, and the firewall is derived from it by reconciling rather
than opened and shut on its own. That is what lets expiry be the default: a rule
left behind - standing access of exactly the kind this design exists to end - is
closed on the next run instead of persisting.

The rule is written in two places. The security group is the one that matters,
because AWS enforces it off the instance and it lives in the customer's own
account; ufw is set to match so the gate also exists on a CloudHub that is not
in EC2. Reaching the fleet is not a second grant: bots and hubs are reached
onward from the shell this gives, with the tooling that already does that.

Every bound is applied on each run rather than once when the record was written:
the grant's own expiry, and two weeks from when it was made. So a record edited
on this machine can only ever shorten access, never extend it.
"""

import argparse
import ipaddress
import json
import os
import subprocess
import sys
import time
import urllib.request

MAX_DAYS = 14
SSH_PORT = 22

STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
GRANT_FILE = os.path.join(STATE_DIR, "grant.json")
OPEN_FILE = os.path.join(STATE_DIR, "open.json")
AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")
LAST_RUN_FILE = os.path.join(STATE_DIR, "last-reconcile")

AWS = os.environ.get("JAIA_AWS", "aws")
UFW = os.environ.get("JAIA_UFW", "ufw")
SS = os.environ.get("JAIA_SS", "ss")
IMDS = os.environ.get("JAIA_IMDS", "http://169.254.169.254")


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


##############
## Addresses ##
##############

def as_cidr(address):
    """One host unless a width was asked for, and strict about the width: a prefix
    with host bits set is refused rather than rounded down, since 198.51.100.7/24
    reads as one address and would admit 256."""
    text = address.strip()
    if "/" in text:
        return str(ipaddress.ip_network(text))
    return str(ipaddress.ip_network(text + ("/128" if ":" in text else "/32")))


def is_v6(cidr):
    return ipaddress.ip_network(cidr).version == 6


##############
## Firewall ##
##############

# Loopback-only link-local service, so nothing on the way sees the token
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def imds(path, token=None):
    method = "PUT" if token is None else "GET"
    url = IMDS + ("/latest/api/token" if token is None else "/latest/meta-data/" + path)
    headers = ({"X-aws-ec2-metadata-token-ttl-seconds": "60"} if token is None
               else {"X-aws-ec2-metadata-token": token})
    request = urllib.request.Request(url, headers=headers, method=method)
    with _opener.open(request, timeout=5) as answer:
        return answer.read().decode().strip()


def security_group():
    """The CloudHub's own group, asked of the instance rather than configured, so
    a rebuilt CloudHub needs nothing rewritten."""
    if os.environ.get("JAIA_SECURITY_GROUP"):
        return os.environ["JAIA_SECURITY_GROUP"]
    token = imds(None)
    mac = imds("network/interfaces/macs/", token).splitlines()[0].strip("/")
    return imds("network/interfaces/macs/{}/security-group-ids".format(mac),
                token).split()[0]


def permissions(cidr):
    ranges = ("Ipv6Ranges" if is_v6(cidr) else "IpRanges",
              "CidrIpv6" if is_v6(cidr) else "CidrIp")
    return json.dumps([{"IpProtocol": "tcp", "FromPort": SSH_PORT, "ToPort": SSH_PORT,
                        ranges[0]: [{ranges[1]: cidr,
                                     "Description": "jaia support access"}]}])


def security_group_rule(action, cidr):
    """Absent when it should go and present when it should come is success either
    way: this runs on a timer, so it must converge rather than complain."""
    done = subprocess.run(
        [AWS, "ec2", "{}-security-group-ingress".format(action),
         "--group-id", security_group(), "--ip-permissions", permissions(cidr)],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if done.returncode == 0:
        return
    harmless = ("InvalidPermission.Duplicate" if action == "authorize"
                else "InvalidPermission.NotFound")
    if harmless in done.stderr:
        return
    raise RuntimeError(done.stderr.strip() or "aws {} failed".format(action))


def ufw_rule(action, cidr):
    command = [UFW, "--force"] if action == "delete" else [UFW]
    command += (["delete"] if action == "delete" else [])
    command += ["allow", "from", cidr, "to", "any", "port", str(SSH_PORT), "proto", "tcp"]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def open_to(cidr):
    security_group_rule("authorize", cidr)
    ufw_rule("allow", cidr)


def disconnect(cidr):
    # Neither the security group nor ufw ends a connection it is already tracking,
    # so closing the port alone would leave an open session running
    subprocess.run([SS, "-K", "state", "established", "( sport = :{} )".format(SSH_PORT),
                    "dst", cidr], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def close_to(cidr):
    security_group_rule("revoke", cidr)
    ufw_rule("delete", cidr)
    disconnect(cidr)


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


def granted_cidr():
    granted = read_json(GRANT_FILE) or {}
    return granted.get("source")


#################
## Reconciling ##
#################

def reconcile():
    now = int(time.time())

    approved = grant_window(now)
    wanted = granted_cidr() if approved else None

    if not approved and os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
        audit("end", {"why": "expired"})

    held = read_json(OPEN_FILE)
    if held and held.get("cidr") != wanted:
        close_to(held["cidr"])
        os.unlink(OPEN_FILE)
        held = None

    if wanted and not held:
        open_to(wanted)
        os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
        write_json(OPEN_FILE, {"cidr": wanted, "opened_at": now})

    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LAST_RUN_FILE, "w") as f:
        f.write("{}\n".format(now))
    return approved, wanted


##############
## Commands ##
##############

def cmd_approve(args):
    now = int(time.time())
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit("days must be between 1 and {}".format(MAX_DAYS))
    try:
        source = as_cidr(args.source)
    except ValueError:
        sys.exit("--source must be an IP address or CIDR, not {!r}".format(args.source))

    granted = {"fleet": args.fleet, "days": args.days, "reason": args.reason,
               "source": source, "approved_at": now, "approved_by": args.by,
               "signer": args.signer, "expires_at": now + args.days * 86400}
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    write_json(GRANT_FILE, granted)
    audit("grant", granted)

    approved, wanted = reconcile()
    if not wanted:
        sys.exit("the grant did not survive reconciliation")
    print(granted["expires_at"])


def cmd_revoke(args):
    if os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
    audit("end", {"why": "revoked", "revoked_by": args.by})
    reconcile()


def cmd_reconcile(args):
    try:
        approved, wanted = reconcile()
    except Exception as problem:
        sys.exit("could not reconcile the firewall: {}".format(problem))
    print("{} until {}".format(
        wanted or "closed",
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "-"))


def cmd_status(args):
    """What the support page reads. What the firewall actually holds is reported
    from this machine's own record of it, so a rule opened by hand shows up as
    the absence of one rather than as a grant."""
    state = {"fleet": fleet_id(), "grant": read_json(GRANT_FILE),
             "open": read_json(OPEN_FILE), "last_reconcile": None, "trouble": ""}
    try:
        with open(LAST_RUN_FILE) as f:
            state["last_reconcile"] = int(f.read().strip())
    except (OSError, ValueError):
        pass
    print(json.dumps(state))


def cmd_list(args):
    approved = grant_window(int(time.time()))
    held = read_json(OPEN_FILE)
    print("granted until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "- (none)"))
    print("port {} open to {}".format(SSH_PORT, held["cidr"] if held else "- (nobody)"))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    actions = parser.add_subparsers(dest="action", required=True)

    approve = actions.add_parser("approve", help="record the customer's approval")
    approve.add_argument("--fleet", type=int, required=True)
    approve.add_argument("--days", type=int, required=True)
    approve.add_argument("--source", required=True,
                         help="the address to admit, as signed in the request")
    approve.add_argument("--reason", default="")
    approve.add_argument("--by", default="")
    approve.add_argument("--signer", default="")
    approve.set_defaults(run=cmd_approve)

    revoke = actions.add_parser("revoke", help="end the customer's approval")
    revoke.add_argument("--by", default="")
    revoke.set_defaults(run=cmd_revoke)

    actions.add_parser("reconcile", help="bring the firewall back in line with the grant") \
           .set_defaults(run=cmd_reconcile)
    actions.add_parser("status", help="print what is granted, as JSON") \
           .set_defaults(run=cmd_status)
    actions.add_parser("list", help="show the grant in force").set_defaults(run=cmd_list)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
