#!/usr/bin/env python3

"""The CloudHub a support grant is made on, in miniature.

Stand-ins for the three things a grant touches - the EC2 security group, ufw and
the directory - each recording what it was told, and the environment that points
the real scripts at them. The stub security group answers like the real one for
the two cases the scripts rely on converging: authorizing a rule that is already
there, and revoking one that is not. The stub directory answers LLDAP's own
GraphQL shapes, including the error for a user it has never heard of, because
that is what a CloudHub bootstrapped before the support account looks like.
"""

import http.server
import json
import os
import pathlib
import socket
import subprocess
import threading

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
AUTHORIZE = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-authorize.sh"

FLEET = 7
SECURITY_GROUP = "sg-0fa1afe1"
SUPPORT_ACCOUNT = "jaia_support"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def closed_port():
    """Bound and released, so connecting to it is refused at once rather than
    hanging until the timeout."""
    return free_port()


def stub(path, body):
    with open(path, "w") as f:
        f.write("#!/usr/bin/env python3\n" + body)
    os.chmod(path, 0o755)


AWS_STUB = '''
import json, os, sys

held = os.environ["STUB_SG_FILE"]
argv = sys.argv[1:]
with open(os.environ["STUB_AWS_LOG"], "a") as f:
    f.write(" ".join(argv) + "\\n")

action = argv[1] if len(argv) > 1 else ""
permissions = json.loads(argv[argv.index("--ip-permissions") + 1])
cidrs = [r.get("CidrIp") or r.get("CidrIpv6")
         for p in permissions for key in ("IpRanges", "Ipv6Ranges") for r in p.get(key, [])]

try:
    open_now = json.load(open(held))
except (OSError, ValueError):
    open_now = []

if action == "authorize-security-group-ingress":
    if any(c in open_now for c in cidrs):
        sys.stderr.write("An error occurred (InvalidPermission.Duplicate)\\n")
        sys.exit(1)
    open_now += cidrs
elif action == "revoke-security-group-ingress":
    if not any(c in open_now for c in cidrs):
        sys.stderr.write("An error occurred (InvalidPermission.NotFound)\\n")
        sys.exit(1)
    open_now = [c for c in open_now if c not in cidrs]
else:
    sys.stderr.write("unknown action {}\\n".format(action))
    sys.exit(2)

json.dump(open_now, open(held, "w"))
'''

UFW_STUB = '''
import os, sys

with open(os.environ["STUB_UFW_LOG"], "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\\n")
'''

SS_STUB = '''
import os, sys

with open(os.environ["STUB_SS_LOG"], "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\\n")
'''


LLDAP_PASSWORD = "not-the-real-one"
LLDAP_GROUPS = ("run", "sim", "jdv", "jcu_developer", "rest_api_read", "lldap_admin")


class StubLldap:
    """Enough of LLDAP 0.6.3's HTTP surface for the real client to drive it."""

    def __init__(self, membership):
        self.membership = membership        # {user: [group, ...]}, the whole directory
        self.calls = []
        stub = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def reply(self, payload):
                body = json.dumps(payload).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                asked = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                if self.path == "/auth/simple/login":
                    if asked.get("password") != LLDAP_PASSWORD:
                        self.send_error(401)
                        return
                    stub.calls.append("login as {}".format(asked.get("username")))
                    self.reply({"token": "stub-token"})
                    return

                query, variables = asked["query"], asked.get("variables", {})
                if "addUserToGroup" in query or "removeUserFromGroup" in query:
                    user = variables["user"]
                    name = dict((i, g) for g, i in stub.ids().items())[variables["group"]]
                    held = stub.membership.setdefault(user, [])
                    if "add" in query:
                        stub.calls.append("add {} to {}".format(user, name))
                        if name not in held:
                            held.append(name)
                    else:
                        stub.calls.append("remove {} from {}".format(user, name))
                        if name in held:
                            held.remove(name)
                    self.reply({"data": {"ok": True}})
                elif "user(userId:" in query:
                    user = variables["user"]
                    if user not in stub.membership:
                        self.reply({"errors": [{"message": "Could not find user"}]})
                        return
                    stub.calls.append("read {}".format(user))
                    self.reply({"data": {"user": {"groups": [
                        {"displayName": name} for name in stub.membership[user]]}}})
                elif "groups {" in query:
                    self.reply({"data": {"groups": [
                        {"id": i, "displayName": name} for name, i in stub.ids().items()]}})
                else:
                    self.send_error(400)

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def ids(self):
        return {name: number for number, name in enumerate(LLDAP_GROUPS, start=1)}

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


class CloudHub:
    def __init__(self, directory):
        self.dir = directory
        self.state = os.path.join(directory, "state")
        self.bin = os.path.join(directory, "bin")
        self.security_group = os.path.join(directory, "security-group.json")
        self.aws_log = os.path.join(directory, "aws.log")
        self.ufw_log = os.path.join(directory, "ufw.log")
        self.ss_log = os.path.join(directory, "ss.log")
        self.secrets = os.path.join(directory, "secrets")
        self.tmp_authorized_keys = os.path.join(directory, "tmp_authorized_keys")
        os.makedirs(self.bin)

        key = os.path.join(directory, "id_vpn_tmp")
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "id_vpn_tmp",
                        "-f", key], check=True)
        with open(key + ".pub") as f:
            self.bootstrap_key = f.read().strip()

        stub(os.path.join(self.bin, "aws"), AWS_STUB)
        stub(os.path.join(self.bin, "ufw"), UFW_STUB)
        stub(os.path.join(self.bin, "ss"), SS_STUB)

        with open(self.secrets, "w") as f:
            f.write("authelia_ldap_password={}\n".format(LLDAP_PASSWORD))
        # Bootstrapped groupless, as jaia_configure_authelia.sh writes it
        self.lldap = StubLldap({SUPPORT_ACCOUNT: []})

    def close(self):
        self.lldap.close()

    def forget_the_support_account(self):
        """A CloudHub bootstrapped before the account existed."""
        self.lldap.membership.pop(SUPPORT_ACCOUNT, None)

    def environment(self, **extra):
        held = dict(os.environ,
                    JAIA_FLEET_ID=str(FLEET),
                    JAIA_SUPPORT_STATE_DIR=self.state,
                    JAIA_AWS=os.path.join(self.bin, "aws"),
                    JAIA_UFW=os.path.join(self.bin, "ufw"),
                    JAIA_SS=os.path.join(self.bin, "ss"),
                    JAIA_SECURITY_GROUP=SECURITY_GROUP,
                    STUB_SG_FILE=self.security_group,
                    STUB_AWS_LOG=self.aws_log,
                    STUB_UFW_LOG=self.ufw_log,
                    STUB_SS_LOG=self.ss_log,
                    JAIA_AUTH_SECRETS=self.secrets,
                    JAIA_VPN_AUTHORIZE=str(AUTHORIZE),
                    JAIA_TMP_AUTHORIZED_KEYS=self.tmp_authorized_keys,
                    JAIA_LLDAP_URL="http://127.0.0.1:{}".format(self.lldap.port))
        held.update(extra)
        return held

    def off_ec2(self):
        """A CloudHub that is not in EC2: no configured group, and an instance
        metadata service that refuses rather than answers."""
        return {"JAIA_SECURITY_GROUP": "",
                "JAIA_IMDS": "http://127.0.0.1:{}".format(closed_port())}

    ## What the CloudHub ended up with

    def open_to(self):
        """The addresses the security group admits, as the stub holds them."""
        try:
            with open(self.security_group) as f:
                return sorted(json.load(f))
        except (OSError, ValueError):
            return []

    def _log(self, path):
        try:
            with open(path) as f:
                return [line.strip() for line in f if line.strip()]
        except OSError:
            return []

    def hand_over(self):
        """What create_vpc.sh does last, after which port 22 is the reconcile timer's."""
        os.makedirs(self.state, exist_ok=True)
        open(os.path.join(self.state, "handed-over"), "w").close()

    def enrollment_line(self):
        """The line authorizing the bootstrap key, as sshd would read it, or None."""
        blob = self.bootstrap_key.split()[1]
        try:
            with open(self.tmp_authorized_keys) as f:
                lines = [line.strip() for line in f if blob in line]
        except OSError:
            return None
        return lines[0] if lines else None

    def open_to_everyone(self):
        held = self.open_to()
        return "0.0.0.0/0" in held and "::/0" in held

    def web_groups(self):
        """The groups the support account is in, as the directory holds them."""
        return sorted(self.lldap.membership.get(SUPPORT_ACCOUNT, []))

    def lldap_calls(self):
        return list(self.lldap.calls)

    def aws_calls(self):
        return self._log(self.aws_log)

    def ufw_calls(self):
        return self._log(self.ufw_log)

    def ss_calls(self):
        return self._log(self.ss_log)

    def audit(self):
        with open(os.path.join(self.state, "audit.log")) as f:
            return [json.loads(line) for line in f if line.strip()]
