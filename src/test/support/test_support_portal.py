#!/usr/bin/env python3

"""Neither Jaia nor the customer can grant support access alone.

The portal is the customer's half of that: it draws an approve button only for a
request that ssh-keygen verifies against Jaia's root keys, for this fleet,
inside the window it was signed for. These tests drive the real service over
HTTP, with real signatures, against a stand-in CloudHub - so a forged, altered,
stale, over-long or misaddressed request is tested against the code that
answers it, and an approval is followed all the way into the directory.
"""

import json
import os
import pathlib
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request

from support_stubs import FLEET, CloudHub, FakeLldap, free_port

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
PORTAL = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-portal.py"
ACCESS = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-access.py"

BEGIN = "-----BEGIN JAIA SUPPORT REQUEST-----"
END = "-----END JAIA SUPPORT REQUEST-----"

# Proxy settings in the environment would send a loopback request elsewhere
NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class PortalTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.hub = CloudHub(self.dir)
        self.addCleanup(self.hub.close)

        self.key = os.path.join(self.dir, "root_key")
        self.keygen(self.key)
        self.stranger = os.path.join(self.dir, "stranger_key")
        self.keygen(self.stranger)

        self.allowed_signers = os.path.join(self.dir, "allowed_signers")
        with open(self.allowed_signers, "w") as f, open(self.key + ".pub") as pub:
            f.write("jaia-support {}\n".format(" ".join(pub.read().split()[:2])))

        self.port = free_port()
        self.start()

    def keygen(self, path):
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "jaia@root_yubikey",
                        "-f", path], check=True)

    def start(self):
        environment = self.hub.environment(
            JAIA_SUPPORT_ALLOWED_SIGNERS=self.allowed_signers,
            JAIA_SUPPORT_ACCESS=str(ACCESS),
            JAIA_SUPPORT_PORTAL_PORT=str(self.port))
        self.portal = subprocess.Popen(["python3", str(PORTAL)], env=environment,
                                       stderr=subprocess.DEVNULL)
        self.addCleanup(self.stop)

        for _ in range(100):
            try:
                with socket.create_connection(("127.0.0.1", self.port), 0.1):
                    return
            except OSError:
                time.sleep(0.05)
        self.fail("the portal did not start")

    def stop(self):
        self.portal.terminate()
        self.portal.wait(timeout=10)

    ## Requests

    def sign(self, key=None, fleet=FLEET, days=7, reason="Pump fault on bot 3",
             expires_in=7 * 86400, tamper=None):
        requested_at = int(time.time())
        payload = json.dumps({"fleet": fleet, "days": days, "requested_at": requested_at,
                              "expires_at": requested_at + expires_in, "reason": reason},
                             separators=(",", ":"))
        signed = os.path.join(self.dir, "payload")
        with open(signed, "w") as f:
            f.write(payload)
        subprocess.run(["ssh-keygen", "-Y", "sign", "-f", key or self.key, "-n", "jaia-support",
                        "-q", signed], check=True)
        with open(signed + ".sig") as f:
            signature = f.read()
        if tamper:
            payload = tamper(payload)
        return "{}\n{}\n{}{}\n".format(BEGIN, payload, signature, END)

    ## HTTP

    def get(self):
        request = urllib.request.Request("http://127.0.0.1:{}/".format(self.port))
        with NO_PROXY.open(request) as answer:
            cookie = answer.headers.get("Set-Cookie", "")
            if cookie:
                self.cookie = cookie.split(";")[0]
            return answer.read().decode()

    def post(self, action, pasted="", csrf=None, user="operator"):
        if not hasattr(self, "cookie"):
            self.get()
        fields = {"action": action, "request": pasted,
                  "csrf": self.cookie.split("=", 1)[1] if csrf is None else csrf}
        headers = {"Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded"}
        if user:
            headers["Remote-User"] = user
        request = urllib.request.Request(
            "http://127.0.0.1:{}/".format(self.port),
            data=urllib.parse.urlencode(fields).encode(), headers=headers, method="POST")
        try:
            with NO_PROXY.open(request) as answer:
                return answer.status, answer.read().decode()
        except urllib.error.HTTPError as refused:
            return refused.code, refused.read().decode()

    def grant(self):
        with open(os.path.join(self.hub.state, "grant.json")) as f:
            return json.load(f)

    ## Tests

    def test_shows_no_access_until_something_is_granted(self):
        page = self.get()
        self.assertIn("Jaia has no access to this fleet", page)
        self.assertNotIn("End Jaia&#x27;s access now", page)

    def test_a_signed_request_is_shown_for_approval(self):
        status, page = self.post("review", self.sign(reason="Pump fault on bot 3"))
        self.assertEqual(200, status)
        self.assertIn("signed by a Jaia root key", page)
        self.assertIn("Pump fault on bot 3", page)
        self.assertIn("Approve", page)
        # nothing is granted by looking at it
        self.assertEqual(set(), FakeLldap.members)

    def test_an_altered_request_is_refused(self):
        pasted = self.sign(days=5, tamper=lambda p: p.replace('"days":5', '"days":14'))
        status, page = self.post("review", pasted)
        self.assertIn("changed since it was signed", page)
        self.assertNotIn("Approve", page)

    def test_a_request_signed_by_a_stranger_is_refused(self):
        status, page = self.post("review", self.sign(key=self.stranger))
        self.assertIn("No Jaia root key signed this request", page)

    def test_a_request_for_another_fleet_is_refused(self):
        status, page = self.post("review", self.sign(fleet=FLEET + 1))
        self.assertIn("asks for fleet {}".format(FLEET + 1), page)

    def test_a_lapsed_request_is_refused(self):
        status, page = self.post("review", self.sign(expires_in=-60))
        self.assertIn("lapsed", page)

    def test_more_than_two_weeks_is_refused(self):
        status, page = self.post("review", self.sign(days=30))
        self.assertIn("14 is the most", page)

    def test_text_that_is_not_a_request_is_refused(self):
        status, page = self.post("review", "please let me in")
        self.assertIn("not a Jaia support request", page)

    def test_approving_puts_the_support_account_in_the_group(self):
        status, page = self.post("approve", self.sign(days=3, reason="Pump fault on bot 3"))
        self.assertEqual(200, status)
        self.assertEqual({"jaia_support"}, FakeLldap.members)

        granted = self.grant()
        self.assertEqual(3, granted["days"])
        self.assertEqual("operator", granted["approved_by"])
        # the window runs from the approval, not from when Jaia asked
        self.assertAlmostEqual(granted["approved_at"] + 3 * 86400, granted["expires_at"], delta=2)
        self.assertIn("SHA256:", granted["signer"])

        self.assertIn("Jaia has access to this fleet until", page)
        self.assertIn("Jaia has access to this fleet until", self.get())

    def test_approving_an_altered_request_grants_nothing(self):
        pasted = self.sign(days=1, tamper=lambda p: p.replace('"days":1', '"days":14'))
        self.post("approve", pasted)
        self.assertEqual(set(), FakeLldap.members)
        self.assertFalse(os.path.exists(os.path.join(self.hub.state, "grant.json")))

    def test_revoking_takes_the_account_back_out_of_the_group(self):
        self.post("approve", self.sign())
        self.assertEqual({"jaia_support"}, FakeLldap.members)

        status, page = self.post("revoke")
        self.assertEqual(200, status)
        self.assertEqual(set(), FakeLldap.members)
        self.assertFalse(os.path.exists(os.path.join(self.hub.state, "grant.json")))
        self.assertIn("Jaia has no access to this fleet", self.get())

    def test_the_page_shows_what_has_been_granted(self):
        self.post("approve", self.sign(reason="Pump fault on bot 3"))
        self.post("revoke")
        page = self.get()
        self.assertIn("Pump fault on bot 3", page)
        self.assertIn("<td>grant</td>", page)
        self.assertIn("<td>end</td>", page)

    def test_a_post_from_another_site_is_refused(self):
        status, _ = self.post("approve", self.sign(), csrf="not-the-token")
        self.assertEqual(403, status)
        self.assertEqual(set(), FakeLldap.members)

    def test_a_post_that_did_not_come_through_the_login_is_refused(self):
        status, _ = self.post("approve", self.sign(), user=None)
        self.assertEqual(403, status)
        self.assertEqual(set(), FakeLldap.members)


if __name__ == "__main__":
    unittest.main()
