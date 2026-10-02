#!/usr/bin/env python3

"""The CloudHub a support grant is made on, in miniature.

Shared by the tier 3 and portal tests: a stand-in user directory, a peer
directory, a set of nodes that record what they were told to run, and the
environment that points the real scripts at all of it.
"""

import http.server
import json
import os
import socket
import threading

FLEET = 7
CLOUDHUB_ADDR = "fd0f:77ac:4fdf:7::1:1e"
NODES = ["fd0f:77ac:4fdf:7::2:1", "fd0f:77ac:4fdf:7::2:2", "fd0f:77ac:4fdf:7::1:1"]
ADMIN_PASSWORD = "e3b0c44298fc1c149afbf4c8996fb924"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def stub(path, body):
    with open(path, "w") as f:
        f.write("#!/bin/sh\n" + body)
    os.chmod(path, 0o755)


class FakeLldap(http.server.BaseHTTPRequestHandler):
    """Just enough of LLDAP's API to answer the calls the scripts make."""

    members = set()
    groups = [{"id": 3, "displayName": "jaia_support"}, {"id": 1, "displayName": "lldap_admin"}]

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))

        if self.path == "/auth/simple/login":
            ok = body.get("password") == ADMIN_PASSWORD
            self.answer({"token": "a-token"} if ok else {"error": "bad password"},
                        200 if ok else 401)
            return

        if self.headers.get("Authorization") != "Bearer a-token":
            self.answer({"errors": [{"message": "unauthorized"}]}, 401)
            return

        query, variables = body["query"], body["variables"]
        if "groups { id displayName }" in query:
            self.answer({"data": {"groups": self.groups}})
        elif "user(userId:" in query:
            held = [g for g in self.groups if g["displayName"] in FakeLldap.members]
            self.answer({"data": {"user": {"groups": held}}})
        elif "addUserToGroup" in query:
            FakeLldap.members.add(self.group_name(variables["group"]))
            self.answer({"data": {"addUserToGroup": {"ok": True}}})
        elif "removeUserFromGroup" in query:
            FakeLldap.members.discard(self.group_name(variables["group"]))
            self.answer({"data": {"removeUserFromGroup": {"ok": True}}})
        else:
            self.answer({"errors": [{"message": "unknown query"}]})

    def group_name(self, group_id):
        return next(g["displayName"] for g in self.groups if g["id"] == group_id)

    def answer(self, payload, status=200):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class CloudHub:
    def __init__(self, directory):
        self.dir = directory
        self.state = os.path.join(directory, "state")
        self.tier3 = os.path.join(self.state, "tier3")
        self.peers = os.path.join(directory, "peers")
        self.pushes = os.path.join(directory, "pushes")
        self.unreachable = os.path.join(directory, "unreachable")
        self.bin = os.path.join(directory, "bin")
        os.makedirs(self.peers)
        os.makedirs(self.bin)
        open(self.unreachable, "w").close()

        FakeLldap.members = set()
        self.lldap = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeLldap)
        threading.Thread(target=self.lldap.serve_forever, daemon=True).start()

        self.secrets = os.path.join(directory, "secrets")
        with open(self.secrets, "w") as f:
            f.write("jwt_secret=irrelevant\nlldap_admin_password={}\n".format(ADMIN_PASSWORD))

        self.inventory = os.path.join(directory, "inventory.yml")
        with open(self.inventory, "w") as f:
            for address in NODES + [CLOUDHUB_ADDR]:
                f.write("    node:\n      ansible_user: jaia\n"
                        "      ansible_host: {}\n".format(address))

        # sudo and 'sudo -u <user>' both just run what follows
        stub(os.path.join(self.bin, "sudo"),
             'if [ "$1" = "-u" ]; then shift 2; fi\nexec "$@"\n')
        stub(os.path.join(self.bin, "jaia_ip"),
             'type=""; id=""\n'
             'while [ $# -gt 0 ]; do\n'
             '  case "$1" in --node_type) type=$2; shift 2;; --node_id) id=$2; shift 2;;'
             ' *) shift;; esac\n'
             'done\n'
             'case "$type" in\n'
             '  desktop) echo "fd0f:77ac:4fdf:7::3:$id";;\n'
             '  hub) [ "$id" = 30 ] && echo "{}" || echo "fd0f:77ac:4fdf:7::1:$id";;\n'
             '  *) echo "fd0f:77ac:4fdf:7::2:$id";;\n'
             'esac\n'.format(CLOUDHUB_ADDR))
        stub(os.path.join(self.bin, "jaia_bounds"), "echo 30\n")
        stub(os.path.join(self.bin, "peers.sh"),
             'action=$1\n'
             'case "$action" in\n'
             '  list) ls "{dir}" 2>/dev/null | sed "s/\\.conf$//";;\n'
             '  add) [ ! -e "{dir}/$3.conf" ] || exit 1; echo "$4 $5" > "{dir}/$3.conf";;\n'
             '  remove) rm -f "{dir}/$3.conf";;\n'
             'esac\n'.format(dir=self.peers))
        # A node refuses if its address is listed as unreachable, and otherwise
        # records what it was asked to run
        stub(os.path.join(self.bin, "ssh"),
             'while [ $# -gt 1 ]; do\n'
             '  case "$1" in -o) shift 2;; *) break;; esac\n'
             'done\n'
             'host=${{1#jaia@}}; shift\n'
             'grep -qx "$host" "{missed}" && exit 255\n'
             'echo "$host $*" >> "{log}"\n'.format(missed=self.unreachable, log=self.pushes))

    def close(self):
        self.lldap.shutdown()
        self.lldap.server_close()

    def environment(self, **extra):
        return dict(os.environ,
                    PATH=self.bin + os.pathsep + os.environ["PATH"],
                    JAIA_FLEET_ID=str(FLEET),
                    JAIA_SUPPORT_STATE_DIR=self.state,
                    JAIA_INVENTORY=self.inventory,
                    JAIA_VPN_PEERS=os.path.join(self.bin, "peers.sh"),
                    JAIA_AUTH_SECRETS=self.secrets,
                    JAIA_LLDAP_URL="http://127.0.0.1:{}".format(self.lldap.server_address[1]),
                    **extra)

    ## What the fleet ended up with

    def peer_names(self):
        return sorted(p[:-5] for p in os.listdir(self.peers) if p.endswith(".conf"))

    def pushed(self):
        try:
            with open(self.pushes) as f:
                return [line.strip() for line in f if line.strip()]
        except OSError:
            return []

    def forget_pushes(self):
        open(self.pushes, "w").close()

    def hosts_given_the_key(self):
        return sorted({line.split()[0] for line in self.pushed() if "tee -a" in line})

    def hosts_told_to_drop_it(self):
        return sorted({line.split()[0] for line in self.pushed() if "tee -a" not in line})

    def audit(self):
        with open(os.path.join(self.state, "audit.log")) as f:
            return [json.loads(line) for line in f if line.strip()]

    def set_unreachable(self, addresses):
        with open(self.unreachable, "w") as f:
            f.writelines(address + "\n" for address in addresses)
