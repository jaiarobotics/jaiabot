#!/usr/bin/env python3

"""The CloudHub a support grant is made on, in miniature.

Stand-ins for the two things a grant touches - the EC2 security group and ufw -
each recording what it was told, and the environment that points the real
scripts at them. The stub security group answers like the real one for the two
cases the scripts rely on converging: authorizing a rule that is already there,
and revoking one that is not.
"""

import json
import os
import socket

FLEET = 7
SECURITY_GROUP = "sg-0fa1afe1"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


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


class CloudHub:
    def __init__(self, directory):
        self.dir = directory
        self.state = os.path.join(directory, "state")
        self.bin = os.path.join(directory, "bin")
        self.security_group = os.path.join(directory, "security-group.json")
        self.aws_log = os.path.join(directory, "aws.log")
        self.ufw_log = os.path.join(directory, "ufw.log")
        self.ss_log = os.path.join(directory, "ss.log")
        os.makedirs(self.bin)

        stub(os.path.join(self.bin, "aws"), AWS_STUB)
        stub(os.path.join(self.bin, "ufw"), UFW_STUB)
        stub(os.path.join(self.bin, "ss"), SS_STUB)

    def close(self):
        pass

    def environment(self, **extra):
        return dict(os.environ,
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
                    **extra)

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

    def aws_calls(self):
        return self._log(self.aws_log)

    def ufw_calls(self):
        return self._log(self.ufw_log)

    def ss_calls(self):
        return self._log(self.ss_log)

    def audit(self):
        with open(os.path.join(self.state, "audit.log")) as f:
            return [json.loads(line) for line in f if line.strip()]
