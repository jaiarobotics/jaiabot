#!/usr/bin/env python3

"""Support access on the CloudHub: what the customer granted, and when it ends.

A grant is a record, and everything else is derived from it by reconciling rather
than switched on and off in step with it. That is what lets expiry be the default:
access left behind - standing access of exactly the kind this design exists to end
- is withdrawn on the next run instead of persisting.

Two scopes, deliberately separate, because they answer different questions.
'shell' is reach: port 22, gated at the CloudHub's security group where there is one
and at ufw where there is not. Exactly one of them, never both - AWS enforces the
security group off the instance and the customer can open it from their own console,
so it is what can still let somebody in when this CloudHub's Authelia will not start
and the support page is down with it; a second lock on the box could only be lifted
from the box. Bots and hubs are reached onward from that shell with the tooling that
already does it. 'web' is sight: the
support account in the directory's read-oriented groups, so Jaia can sign in to
JCC, JDV, the JCU and the read-only API and see what is happening without being
able to touch anything.

Port 22 has a third reason to be open, and it is not support at all. A new bot or hub
joins the CloudHub VPN over SSH, from whatever address it happens to have, so while
fleet pairing is open the port is open to every address and the fleet's bootstrap key
is authorized to enroll. A CloudHub starts with pairing closed; it is opened deliberately
from the JCU's Fleet Changes, and never for longer than a grant. That
is a real cost: while it is open the root keys reach this CloudHub without a grant,
and the support page says so rather than claiming no access. Closing it shuts new
connections only; a session opened during it is not dropped.

They converge differently, and the difference is worth knowing. Closing the port
also drops the sessions it admitted. Taking the groups away does not end a web
session already signed in - Authelia holds those, and they run to their own
expiry - so 'web' revocation is a bound of up to the session lifetime, not an
immediate stop. The page says so rather than implying otherwise.

Every bound is applied on each run rather than once when the record was written:
the grant's own expiry, and two weeks from when it was made. So a record edited
on this machine can only ever shorten access, never extend it.
"""

import argparse
import ipaddress
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

MAX_DAYS = 14
SSH_PORT = 22

SCOPES = ("shell", "web")
SECURITY_GROUP_GATE = "security-group"
UFW_GATE = "ufw"
DEFAULT_SCOPES = ("web",)

ACCOUNT = "jaia_support"
# Read-oriented: what tier 1 is for is seeing the fleet, not driving it. jcu_developer
# is the exception and is here on purpose - the JCU's status playbooks are the useful
# half of a support call, and the role gates reading them as much as running them.
WEB_GROUPS = ("run", "jdv", "jcu_developer", "rest_api_read")

STATE_DIR = os.environ.get("JAIA_SUPPORT_STATE_DIR", "/var/log/jaiabot/auth/support")
GRANT_FILE = os.path.join(STATE_DIR, "grant.json")
OPEN_FILE = os.path.join(STATE_DIR, "open.json")
PAIRING_FILE = os.path.join(STATE_DIR, "pairing.json")
PAIRING_PORT_FILE = os.path.join(STATE_DIR, "pairing-port.json")
BOOTSTRAP_KEY_FILE = os.path.join(STATE_DIR, "bootstrap.pub")
HANDED_OVER_FILE = os.path.join(STATE_DIR, "handed-over")
WEB_FILE = os.path.join(STATE_DIR, "web.json")
AUDIT_FILE = os.path.join(STATE_DIR, "audit.log")
LAST_RUN_FILE = os.path.join(STATE_DIR, "last-reconcile")

AWS = os.environ.get("JAIA_AWS", "aws")
UFW = os.environ.get("JAIA_UFW", "ufw")
SS = os.environ.get("JAIA_SS", "ss")
IMDS = os.environ.get("JAIA_IMDS", "http://169.254.169.254")

SECRETS = os.environ.get("JAIA_AUTH_SECRETS", "/var/log/jaiabot/auth/authelia/secrets")
AUTHORIZE = os.environ.get("JAIA_VPN_AUTHORIZE", "/usr/bin/jaia-vpn-authorize.sh")
EVERYWHERE = ("0.0.0.0/0", "::/0")
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
    """The CloudHub's own group, asked of the instance rather than configured, so a
    rebuilt CloudHub needs nothing rewritten. None off EC2, where there is no such
    thing - which is also what decides which firewall is the gate."""
    if os.environ.get("JAIA_SECURITY_GROUP"):
        return os.environ["JAIA_SECURITY_GROUP"]
    try:
        token = imds(None)
        mac = imds("network/interfaces/macs/", token).splitlines()[0].strip("/")
        return imds("network/interfaces/macs/{}/security-group-ids".format(mac),
                    token).split()[0]
    except Exception:
        return None


def gate():
    """Exactly one firewall decides, and it is the security group wherever there is
    one. AWS enforces that off the instance and the customer can reach it from their
    own console, so a CloudHub whose Authelia will not start can still be let into -
    which a second lock on the box itself would quietly prevent, its only key being
    the page that is down. ufw is the gate only where there is no security group."""
    return SECURITY_GROUP_GATE if security_group() else UFW_GATE


def permissions(cidr):
    ranges = ("Ipv6Ranges" if is_v6(cidr) else "IpRanges",
              "CidrIpv6" if is_v6(cidr) else "CidrIp")
    return json.dumps([{"IpProtocol": "tcp", "FromPort": SSH_PORT, "ToPort": SSH_PORT,
                        ranges[0]: [{ranges[1]: cidr,
                                     "Description": "jaia support access"}]}])


def security_group_rule(action, cidr):
    """Absent when it should go and present when it should come is success either
    way: this runs on a timer, so it must converge rather than complain."""
    group = security_group()
    if not group:
        # Loud rather than skipped: a rule opened through a group we can no longer
        # name is still open, and treating that as done would leave it that way
        raise RuntimeError("this CloudHub has a security group rule to change and "
                           "could not work out which group")
    done = subprocess.run(
        [AWS, "ec2", "{}-security-group-ingress".format(action),
         "--group-id", group, "--ip-permissions", permissions(cidr)],
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


def firewall_rule(using, action, cidr):
    if using == SECURITY_GROUP_GATE:
        security_group_rule("authorize" if action == "open" else "revoke", cidr)
    else:
        ufw_rule("allow" if action == "open" else "delete", cidr)


def open_to(cidr):
    """Returns the gate it used, so closing can go back through the same one rather
    than re-deciding later and leaving a rule behind in the other."""
    using = gate()
    firewall_rule(using, "open", cidr)
    return using


def disconnect(cidr):
    # Neither the security group nor ufw ends a connection it is already tracking,
    # so closing the port alone would leave an open session running
    subprocess.run([SS, "-K", "state", "established", "( sport = :{} )".format(SSH_PORT),
                    "dst", cidr], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def close_to(cidr, using=None):
    firewall_rule(using or gate(), "close", cidr)
    disconnect(cidr)


#############
## Pairing ##
#############

def pairing_window(now):
    """When fleet pairing ends, as this machine is entitled to read the record: the
    cap is applied here and not taken from the file, as it is for a grant. 0 when
    pairing is closed."""
    held = read_json(PAIRING_FILE)
    if not held:
        return 0
    ends = min(int(held.get("expires_at", 0)),
               int(held.get("opened_at", 0)) + MAX_DAYS * 86400)
    return ends if ends > now else 0


def parse_duration(text):
    """'8_hours', '3_days', '2_weeks' as the JCU offers them - underscores, since it
    passes every value through one whitespace-split -e - or 8h / 3d / 2w."""
    found = re.fullmatch(r"\s*(\d+)[\s_]*(h|hours?|d|days?|w|weeks?)\s*", text.lower())
    if not found:
        sys.exit("--duration must be a number of hours, days or weeks, not {!r}".format(text))
    seconds = int(found.group(1)) * {"h": 3600, "d": 86400, "w": 7 * 86400}[found.group(2)[0]]
    if not 0 < seconds <= MAX_DAYS * 86400:
        sys.exit("fleet pairing can be opened for at most {} days".format(MAX_DAYS))
    return seconds


def bootstrap_key():
    try:
        with open(BOOTSTRAP_KEY_FILE) as f:
            return f.read().strip() or None
    except OSError:
        return None


def store_bootstrap_key(key):
    key = key.strip()
    checked = subprocess.run(["ssh-keygen", "-l", "-f", "-"], input=key, text=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # The type has to lead: a line carrying options would put them in ahead of ours
    if checked.returncode != 0 or not re.match(r"(ssh-|ecdsa-|sk-ssh-|sk-ecdsa-)", key):
        sys.exit("--key must be an SSH public key")
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    with open(os.open(BOOTSTRAP_KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600),
              "w") as f:
        f.write(key + "\n")


def converge_enrollment_key(until):
    """Rewritten on every run rather than once, so the key line follows the record
    through anything that loses the file, a reboot included."""
    key = bootstrap_key()
    if not key:
        return
    run([AUTHORIZE, "--until", str(until), key] if until else [AUTHORIZE, "--rm", key])


def converge_pairing_port(now, pairing):
    """A new node enrolls over SSH from wherever it happens to be, so while pairing is
    open port 22 is open to every address. That rule is the provisioning run's until it
    hands the CloudHub over and this one's alone afterwards - two writers would have a
    revoke by one and a record of "open" by the other leaving it shut for the whole
    window. So it is not touched before hand-over, and a rule closed by hand in the
    customer's console stays closed rather than being reasserted on the next run."""
    if not os.path.exists(HANDED_OVER_FILE):
        return
    wanted = bool(pairing)
    held = read_json(PAIRING_PORT_FILE)
    if held is not None and bool(held.get("open")) == wanted:
        return
    using = gate() if wanted else ((held or {}).get("gate") or gate())
    for cidr in EVERYWHERE:
        firewall_rule(using, "open" if wanted else "close", cidr)
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    write_json(PAIRING_PORT_FILE, {"open": wanted, "gate": using, "at": now})
    audit("pairing-port", {"open": wanted})


###########
## LLDAP ##
###########

# Loopback only, so nothing on the way sees the admin password or the answer
_lldap_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def lldap_post(path, payload, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(LLDAP_URL + path, data=json.dumps(payload).encode(),
                                     headers=headers, method="POST")
    with _lldap_opener.open(request, timeout=15) as answer:
        return json.loads(answer.read().decode())


def lldap_login():
    """As the directory's own service account, not the administrator: that one is a
    person's login whose password they may change, and a login that breaks when they
    do would take the expiry of their own grant with it."""
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


def held_groups(token):
    """None when the directory has no such account - a CloudHub bootstrapped before
    it existed. That is not the same as holding nothing, and only the caller knows
    whether the difference matters."""
    try:
        groups = graphql(
            token, "query($user: String!) { user(userId: $user) { groups { displayName } } }",
            {"user": ACCOUNT})["user"]["groups"]
    except RuntimeError:
        return None
    return {group["displayName"] for group in groups}


def group_ids(token):
    return {group["displayName"]: group["id"]
            for group in graphql(token, "query { groups { id displayName } }", {})["groups"]}


def set_web_access(wanted):
    """Only the groups this grant is about, so a membership the customer added by hand
    for their own reasons is left where they put it."""
    token = lldap_login()
    held = held_groups(token)
    if held is None:
        if not wanted:
            # An account that is not there holds nothing, which is what was wanted
            return False
        raise RuntimeError("LLDAP has no '{}' account".format(ACCOUNT))

    wrong = [name for name in WEB_GROUPS if (name in held) != wanted]
    if not wrong:
        return False

    known = group_ids(token)
    absent = [name for name in wrong if name not in known]
    if absent:
        raise RuntimeError("LLDAP has no group {}".format(", ".join(sorted(absent))))

    mutation = ("mutation($user: String!, $group: Int!) "
                "{ addUserToGroup(userId: $user, groupId: $group) { ok } }" if wanted else
                "mutation($user: String!, $group: Int!) "
                "{ removeUserFromGroup(userId: $user, groupId: $group) { ok } }")
    for name in wrong:
        graphql(token, mutation, {"user": ACCOUNT, "group": known[name]})
    return True


def web_access_held():
    """Any of the groups, not all: a half-applied grant is access, and reporting it as
    none would be the comfortable answer rather than the true one."""
    return bool((held_groups(lldap_login()) or set()) & set(WEB_GROUPS))


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


def granted_scopes():
    """A record that does not say what it granted granted nothing: the safe reading
    of a damaged file is the one that withdraws access rather than keeps it."""
    granted = read_json(GRANT_FILE) or {}
    return {scope for scope in granted.get("scopes", []) if scope in SCOPES}


#################
## Reconciling ##
#################

def reconcile():
    """The firewall first and the directory second, each independent of the other:
    LLDAP being unreachable must not be able to hold a port open."""
    now = int(time.time())

    approved = grant_window(now)
    scopes = granted_scopes() if approved else set()
    wanted = granted_cidr() if "shell" in scopes else None

    if not approved and os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
        audit("end", {"why": "expired"})

    held = read_json(OPEN_FILE)
    if held and held.get("cidr") != wanted:
        close_to(held["cidr"], held.get("gate"))
        os.unlink(OPEN_FILE)
        held = None

    if wanted and not held:
        using = open_to(wanted)
        os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
        write_json(OPEN_FILE, {"cidr": wanted, "gate": using, "opened_at": now})

    # Tracked here rather than asked of LLDAP every run, as the firewall rule is:
    # a timer that talks to the directory when it has nothing to change is a timer
    # that fails whenever the directory is down, having had nothing to do
    pairing = pairing_window(now)
    if not pairing and os.path.exists(PAIRING_FILE):
        os.unlink(PAIRING_FILE)
        audit("pairing", {"open": False, "why": "expired"})

    troubles = []
    try:
        converge_enrollment_key(pairing)
    except Exception as problem:
        troubles.append("could not set the enrollment key: {}".format(problem))
    try:
        converge_pairing_port(now, pairing)
    except Exception as problem:
        troubles.append("could not set the pairing port: {}".format(problem))

    want_web = "web" in scopes
    if bool(read_json(WEB_FILE)) != want_web:
        try:
            set_web_access(want_web)
            if want_web:
                os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
                write_json(WEB_FILE, {"granted_at": now})
            elif os.path.exists(WEB_FILE):
                os.unlink(WEB_FILE)
            audit("web", {"granted": want_web})
        except Exception as problem:
            troubles.append("could not reach the directory: {}".format(problem))

    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LAST_RUN_FILE, "w") as f:
        f.write("{}\n".format(now))
    return approved, wanted, "; ".join(troubles)


##############
## Commands ##
##############

def parse_scopes(text):
    asked = [scope.strip() for scope in text.split(",") if scope.strip()]
    unknown = [scope for scope in asked if scope not in SCOPES]
    if unknown or not asked:
        sys.exit("--scopes must be a comma-separated list of {}, not {!r}"
                 .format(" and ".join(SCOPES), text))
    return asked


def cmd_approve(args):
    now = int(time.time())
    if not 1 <= args.days <= MAX_DAYS:
        sys.exit("days must be between 1 and {}".format(MAX_DAYS))
    scopes = parse_scopes(args.scopes)
    try:
        source = as_cidr(args.source)
    except ValueError:
        sys.exit("--source must be an IP address or CIDR, not {!r}".format(args.source))

    granted = {"fleet": args.fleet, "days": args.days, "reason": args.reason,
               "source": source, "scopes": scopes, "approved_at": now,
               "approved_by": args.by, "signer": args.signer,
               "expires_at": now + args.days * 86400}
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    write_json(GRANT_FILE, granted)
    audit("grant", granted)

    approved, wanted, trouble = reconcile()
    if "shell" in scopes and not wanted:
        sys.exit("the grant did not survive reconciliation")
    if trouble:
        sys.exit(trouble)
    print(granted["expires_at"])


def cmd_revoke(args):
    if os.path.exists(GRANT_FILE):
        os.unlink(GRANT_FILE)
    audit("end", {"why": "revoked", "revoked_by": args.by})
    reconcile()


def cmd_open_pairing(args):
    now = int(time.time())
    seconds = parse_duration(args.duration)
    if not bootstrap_key():
        sys.exit("this CloudHub holds no bootstrap key to authorize; it is given one "
                 "when it is created")

    held = {"opened_at": now, "expires_at": now + seconds, "by": args.by}
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    write_json(PAIRING_FILE, held)
    audit("pairing", dict(held, open=True))

    approved, wanted, trouble = reconcile()
    if trouble:
        sys.exit(trouble)
    print("fleet pairing open until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(held["expires_at"]))))


def cmd_set_bootstrap_key(args):
    """Once, at creation: the CloudHub keeps the fleet's bootstrap key so pairing can
    be opened later without anybody having to hand it over again. Pairing stays
    closed - a CloudHub admits nobody until someone opens it."""
    store_bootstrap_key(args.key)
    audit("bootstrap-key", {"stored": True})
    print("bootstrap key stored; fleet pairing is closed until opened")


def cmd_close_pairing(args):
    if os.path.exists(PAIRING_FILE):
        os.unlink(PAIRING_FILE)
    audit("pairing", {"open": False, "why": "closed", "by": args.by})
    approved, wanted, trouble = reconcile()
    if trouble:
        sys.exit(trouble)
    print("fleet pairing closed")


def cmd_reconcile(args):
    try:
        approved, wanted, trouble = reconcile()
    except Exception as problem:
        sys.exit("could not reconcile the firewall: {}".format(problem))
    print("{} until {}".format(
        wanted or "closed",
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "-"))
    if trouble:
        sys.exit(trouble)


def cmd_status(args):
    """What the support page reads. What is actually in force is reported from this
    machine's own record of the firewall, so a rule opened by hand shows up as the
    absence of one rather than as a grant - but web access is asked of the directory,
    which holds it, so a membership added by hand shows up as what it is."""
    pairing = pairing_window(int(time.time()))
    state = {"fleet": fleet_id(), "grant": read_json(GRANT_FILE),
             "open": read_json(OPEN_FILE), "web": None,
             "pairing": {"open": bool(pairing), "until": pairing or None,
                         "by": (read_json(PAIRING_FILE) or {}).get("by") if pairing else None},
             "last_reconcile": None, "trouble": "", "web_trouble": ""}
    try:
        with open(LAST_RUN_FILE) as f:
            state["last_reconcile"] = int(f.read().strip())
    except (OSError, ValueError):
        pass
    # Kept apart from "trouble", which means the page cannot say what is granted at
    # all: an unreachable directory says nothing about the port, and reporting it as
    # a blanket failure would hide state this machine holds and is sure of
    try:
        state["web"] = web_access_held()
    except Exception as problem:
        state["web_trouble"] = "could not reach the directory: {}".format(problem)
    print(json.dumps(state))


def cmd_list(args):
    approved = grant_window(int(time.time()))
    held = read_json(OPEN_FILE)
    print("granted until {}".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(approved)) if approved else "- (none)"))
    print("port {} open to {}".format(SSH_PORT, held["cidr"] if held else "- (nobody)"))
    pairing = pairing_window(int(time.time()))
    print("fleet pairing open until {}: port {} open to every address".format(
        time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(pairing)), SSH_PORT)
          if pairing else "fleet pairing closed")
    try:
        print("web sign-in {}".format("granted" if web_access_held() else "- (not granted)"))
    except Exception as problem:
        print("web sign-in unknown: {}".format(problem))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    actions = parser.add_subparsers(dest="action", required=True)

    approve = actions.add_parser("approve", help="record the customer's approval")
    approve.add_argument("--fleet", type=int, required=True)
    approve.add_argument("--days", type=int, required=True)
    approve.add_argument("--source", required=True,
                         help="the address to admit, as signed in the request")
    approve.add_argument("--scopes", default=",".join(DEFAULT_SCOPES),
                         help="what the customer approved: {}".format(", ".join(SCOPES)))
    approve.add_argument("--reason", default="")
    approve.add_argument("--by", default="")
    approve.add_argument("--signer", default="")
    approve.set_defaults(run=cmd_approve)

    revoke = actions.add_parser("revoke", help="end the customer's approval")
    revoke.add_argument("--by", default="")
    revoke.set_defaults(run=cmd_revoke)

    open_pairing = actions.add_parser("open-pairing",
                                      help="let new bots and hubs enroll on the VPN for a while")
    open_pairing.add_argument("--duration", required=True,
                              help="how long, at most {} days: 1 hour, 3 days, 2 weeks, "
                                   "or 1h / 3d / 2w".format(MAX_DAYS))
    open_pairing.add_argument("--by", default="")
    open_pairing.set_defaults(run=cmd_open_pairing)

    bootstrap = actions.add_parser("set-bootstrap-key",
                                   help="keep the fleet's bootstrap public key for later pairing")
    bootstrap.add_argument("--key", required=True)
    bootstrap.set_defaults(run=cmd_set_bootstrap_key)

    close_pairing = actions.add_parser("close-pairing", help="end fleet pairing now")
    close_pairing.add_argument("--by", default="")
    close_pairing.set_defaults(run=cmd_close_pairing)

    actions.add_parser("reconcile", help="bring the firewall back in line with the grant") \
           .set_defaults(run=cmd_reconcile)
    actions.add_parser("status", help="print what is granted, as JSON") \
           .set_defaults(run=cmd_status)
    actions.add_parser("list", help="show the grant in force").set_defaults(run=cmd_list)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
