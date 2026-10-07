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

from support_stubs import FLEET, CloudHub, free_port

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
             expires_in=7 * 86400, source="198.51.100.7", tamper=None, scopes=("shell",)):
        requested_at = int(time.time())
        asked = {"fleet": fleet, "days": days, "requested_at": requested_at,
                 "expires_at": requested_at + expires_in, "source": source,
                 "reason": reason}
        if scopes is not None:
            asked["scopes"] = list(scopes)
        payload = json.dumps(asked, separators=(",", ":"))
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

    def post(self, action, pasted="", csrf=None, user="operator", ticks=None):
        if not hasattr(self, "cookie"):
            self.get()
        fields = {"action": action, "request": pasted,
                  "csrf": self.cookie.split("=", 1)[1] if csrf is None else csrf}
        # The real form arrives with every box the request asked for already ticked;
        # the server intersects, so offering both here is what a browser would send
        for scope in (("shell", "web") if ticks is None else ticks):
            fields["scope_" + scope] = "yes"
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
        self.assertIn("198.51.100.7", page)
        # nothing is opened by looking at it
        self.assertEqual([], self.hub.open_to())

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

    def test_approving_opens_the_port_to_the_signed_address_alone(self):
        status, page = self.post("approve", self.sign(days=3, reason="Pump fault on bot 3"))
        self.assertEqual(200, status)
        self.assertEqual(["198.51.100.7/32"], self.hub.open_to())
        self.assertTrue(any("authorize-security-group-ingress" in call
                            for call in self.hub.aws_calls()))
        self.assertTrue(any(call.startswith("allow from 198.51.100.7/32")
                            for call in self.hub.ufw_calls()))

        granted = self.grant()
        self.assertEqual("198.51.100.7/32", granted["source"])
        self.assertEqual(3, granted["days"])
        self.assertEqual("operator", granted["approved_by"])
        # the window runs from the approval, not from when Jaia asked
        self.assertAlmostEqual(granted["approved_at"] + 3 * 86400, granted["expires_at"], delta=2)
        self.assertIn("SHA256:", granted["signer"])

        self.assertIn("Jaia has access to this fleet until", page)
        self.assertIn("Jaia has access to this fleet until", self.get())

    def test_approving_an_altered_request_opens_nothing(self):
        pasted = self.sign(days=1, tamper=lambda p: p.replace('"days":1', '"days":14'))
        self.post("approve", pasted)
        self.assertEqual([], self.hub.open_to())
        self.assertFalse(os.path.exists(os.path.join(self.hub.state, "grant.json")))

    def test_an_address_altered_after_signing_opens_nothing(self):
        """The address is what the rule is written from, so it has to be covered by
        the signature rather than taken from the paste."""
        pasted = self.sign(tamper=lambda p: p.replace("198.51.100.7", "203.0.113.9"))
        status, page = self.post("approve", pasted)
        self.assertIn("changed since it was signed", page)
        self.assertEqual([], self.hub.open_to())

    def test_an_address_that_is_not_an_address_is_refused(self):
        status, page = self.post("review", self.sign(source="the office"))
        self.assertIn("not an IP address", page)
        self.assertEqual([], self.hub.open_to())

    def test_revoking_closes_the_port(self):
        self.post("approve", self.sign())
        self.assertEqual(["198.51.100.7/32"], self.hub.open_to())

        status, page = self.post("revoke")
        self.assertEqual(200, status)
        self.assertEqual([], self.hub.open_to())
        self.assertTrue(any("revoke-security-group-ingress" in call
                            for call in self.hub.aws_calls()))
        self.assertFalse(os.path.exists(os.path.join(self.hub.state, "grant.json")))
        self.assertIn("Jaia has no access to this fleet", self.get())

    def test_the_page_shows_what_has_been_granted(self):
        self.post("approve", self.sign(reason="Pump fault on bot 3"))
        self.post("revoke")
        page = self.get()
        self.assertIn("Pump fault on bot 3", page)
        self.assertIn("<td>grant</td>", page)
        self.assertIn("<td>end</td>", page)

    ## What is being asked for, and what the customer actually gives

    def test_the_review_offers_only_what_was_asked_for(self):
        status, page = self.post("review", self.sign(scopes=["shell"]))
        self.assertIn('name="scope_shell"', page)
        self.assertNotIn('name="scope_web"', page)

    def test_a_request_for_both_offers_both_already_ticked(self):
        status, page = self.post("review", self.sign(scopes=["shell", "web"]))
        self.assertIn('name="scope_shell"', page)
        self.assertIn('name="scope_web"', page)
        self.assertEqual(2, page.count("checked"))

    def test_the_customer_can_give_the_shell_and_withhold_the_web(self):
        """The point of having two: approving a request is not all-or-nothing."""
        self.post("approve", self.sign(scopes=["shell", "web"]), ticks=["shell"])
        self.assertEqual(["198.51.100.7/32"], self.hub.open_to())
        self.assertEqual([], self.hub.web_groups())
        self.assertEqual(["shell"], self.grant()["scopes"])

    def test_the_customer_can_give_the_web_and_withhold_the_shell(self):
        self.post("approve", self.sign(scopes=["shell", "web"]), ticks=["web"])
        self.assertEqual([], self.hub.open_to())
        self.assertEqual(["jcu_developer", "jdv", "rest_api_read", "run"],
                         self.hub.web_groups())

    def test_ticking_nothing_grants_nothing_and_says_so(self):
        status, page = self.post("approve", self.sign(scopes=["shell", "web"]), ticks=[])
        self.assertEqual([], self.hub.open_to())
        self.assertEqual([], self.hub.web_groups())
        self.assertIn("Nothing was ticked", page)

    def test_a_box_that_was_not_asked_for_cannot_be_ticked_into_a_grant(self):
        """The form is the customer's, so what it carries is theirs to edit; what was
        asked for is signed, and that is what bounds the grant."""
        self.post("approve", self.sign(scopes=["shell"]), ticks=["shell", "web"])
        self.assertEqual([], self.hub.web_groups())
        self.assertEqual(["shell"], self.grant()["scopes"])

    def test_a_request_signed_before_scopes_existed_is_still_a_shell_request(self):
        """jaia-support-request.sh gained --scopes after the first CloudHubs shipped.
        Refusing an older request as malformed would be the wrong answer."""
        self.post("approve", self.sign(scopes=None))
        self.assertEqual(["198.51.100.7/32"], self.hub.open_to())
        self.assertEqual(["shell"], self.grant()["scopes"])

    def test_a_request_for_a_scope_this_cloudhub_does_not_know_is_refused(self):
        status, page = self.post("review", self.sign(scopes=["root"]))
        self.assertIn("does not know how to grant", page)

    def test_the_page_says_what_each_half_does_before_approval(self):
        """The two revoke differently, and the customer is entitled to know that
        before they decide rather than after."""
        status, page = self.post("review", self.sign(scopes=["shell", "web"]))
        self.assertIn("disconnects anyone still logged in", page)
        self.assertIn("runs to its own expiry", page)

    def test_a_granted_page_names_both_halves(self):
        self.post("approve", self.sign(scopes=["shell", "web"]))
        page = self.get()
        self.assertIn("Log in to this CloudHub", page)
        self.assertIn("Sign in to the web tools", page)

    def test_a_directory_that_cannot_be_reached_does_not_hide_the_port(self):
        """LLDAP is one of two gates; losing sight of it must not blank out the one
        the CloudHub knows for certain."""
        self.post("approve", self.sign(scopes=["shell"]))
        self.hub.lldap.close()
        page = self.get()
        self.assertIn("Jaia has access to this fleet until", page)
        self.assertIn("198.51.100.7/32", page)
        self.assertIn("could not be confirmed", page)

    def test_a_request_from_the_real_script_is_accepted(self):
        """The tests above build the payload themselves, so nothing else would
        notice if jaia-support-request.sh and the portal stopped agreeing on its
        shape. This drives the script the engineer actually runs, as the jaia tool
        runs it."""
        request = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-support-request.sh"
        made = subprocess.run(
            ["bash", str(request), "--binary=jaia admin fleet support_request",
             "--fleet", str(FLEET), "--key", self.key,
             "--reason", "Pump fault on bot 3", "--days", "5", "--from", "198.51.100.7"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, check=True).stdout

        status, page = self.post("approve", made)
        self.assertEqual(200, status)
        self.assertIn("Jaia has access to this fleet until", page)
        self.assertEqual(["198.51.100.7/32"], self.hub.open_to())

    def test_a_post_from_another_site_is_refused(self):
        status, _ = self.post("approve", self.sign(), csrf="not-the-token")
        self.assertEqual(403, status)
        self.assertEqual([], self.hub.open_to())

    def test_a_post_that_did_not_come_through_the_login_is_refused(self):
        status, _ = self.post("approve", self.sign(), user=None)
        self.assertEqual(403, status)
        self.assertEqual([], self.hub.open_to())


if __name__ == "__main__":
    unittest.main()
