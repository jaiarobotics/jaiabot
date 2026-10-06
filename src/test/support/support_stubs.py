#!/usr/bin/env python3

"""The CloudHub a support grant is made on, in miniature.

A stand-in user directory, and the environment that points the real scripts at
it. The grant reaches no further than this machine, so neither does the fake.
"""

import http.server
import json
import os
import socket
import threading

FLEET = 7
ADMIN_USER = "authelia"
ADMIN_PASSWORD = "e3b0c44298fc1c149afbf4c8996fb924"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class FakeLldap(http.server.BaseHTTPRequestHandler):
    """Just enough of LLDAP's API to answer the calls the scripts make."""

    members = set()
    groups = [{"id": 3, "displayName": "jaia_support"}, {"id": 1, "displayName": "lldap_admin"}]

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))

        if self.path == "/auth/simple/login":
            ok = (body.get("username") == ADMIN_USER
                  and body.get("password") == ADMIN_PASSWORD)
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

        FakeLldap.members = set()
        self.lldap = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FakeLldap)
        threading.Thread(target=self.lldap.serve_forever, daemon=True).start()

        self.secrets = os.path.join(directory, "secrets")
        with open(self.secrets, "w") as f:
            f.write("jwt_secret=irrelevant\n"
                    # A key the real secrets file no longer carries, so a bind
                    # reaching for it is caught here rather than on a CloudHub
                    "lldap_admin_password=not-a-key-the-cloudhub-has\n"
                    "authelia_ldap_password={}\n".format(ADMIN_PASSWORD))

    def close(self):
        self.lldap.shutdown()
        self.lldap.server_close()

    def environment(self, **extra):
        return dict(os.environ,
                    JAIA_FLEET_ID=str(FLEET),
                    JAIA_SUPPORT_STATE_DIR=self.state,
                    JAIA_AUTH_SECRETS=self.secrets,
                    JAIA_LLDAP_URL="http://127.0.0.1:{}".format(self.lldap.server_address[1]),
                    **extra)

    def audit(self):
        with open(os.path.join(self.state, "audit.log")) as f:
            return [json.loads(line) for line in f if line.strip()]

