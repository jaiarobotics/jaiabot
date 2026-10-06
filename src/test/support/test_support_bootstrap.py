#!/usr/bin/env python3

"""The CloudHub has to carry the support page before anything can be granted.

jaia_configure_authelia.sh cannot be run here - it installs packages, drives
docker and reloads services - so these tests read what it would write. That is
narrow, but it covers the failures that are quietest: a page published without
the login in front of it, a trust root that leaves out keys the image carries,
and a timer that never runs, each of which leaves a grant looking right and
behaving wrong.
"""

import json
import pathlib
import re
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh"


def heredoc(path, marker):
    """The body of the single `cat ... > <path> <<EOF` block writing that path."""
    text = SCRIPT.read_text()
    pattern = re.compile(r"cat >? ?\"?" + re.escape(marker) + r"\"? ?<<'?EOF'?\n(.*?)\nEOF\n",
                         re.DOTALL)
    found = pattern.findall(text)
    assert len(found) == 1, "{} is written {} times".format(marker, len(found))
    return found[0]


class BootstrapTest(unittest.TestCase):
    def setUp(self):
        self.text = SCRIPT.read_text()

    def test_the_support_portal_is_behind_the_login(self):
        """It trusts whoever reaches it, so serving the site without the forward
        auth would hand the decision to anyone who can resolve the name."""
        site = re.search(r"\nsupport\.\$base_uri \{(.*?)\n\}", self.text, re.DOTALL)
        self.assertIsNotNone(site)
        # jaia_nav only answers /_jaia/ paths; everything else must pass the login first
        handle = re.search(r"\n {8}handle \{\n(.*?)\n {8}\}", site.group(1), re.DOTALL)
        self.assertIsNotNone(handle)
        lines = [line.strip() for line in handle.group(1).splitlines()]
        self.assertEqual(lines, ["import authelia_forward_auth",
                                 "import jaia_nav_proxy :$support_portal_port"])
        self.assertEqual(site.group(1).count("$support_portal_port"), 1)

    def test_only_directory_administrators_may_decide(self):
        rule = re.search(r"- domain: support\.\$base_uri\n(.*?)\nsession:",
                         self.text, re.DOTALL)
        self.assertIsNotNone(rule)
        self.assertIn("policy: 'two_factor'", rule.group(1))
        self.assertIn("group:lldap_admin", rule.group(1))
        self.assertIn("group:super_admin", rule.group(1))

    def test_the_portal_answers_only_through_caddy(self):
        portal = (SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-portal.py").read_text()
        self.assertIn('ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT)', portal)

    def test_the_portal_is_told_which_fleet_it_serves(self):
        """A request names the fleet it is for; without this the portal has
        nothing to compare that against."""
        unit = heredoc(SCRIPT, "/etc/systemd/system/jaia_support_portal.service")
        self.assertIn("Environment=JAIA_FLEET_ID=$jaia_fleet_id", unit)

    def test_the_trust_root_is_every_root_key_on_the_image(self):
        """The compiled-in key list is a subset of root_authorized_keys, so deriving
        the signers from it would silently refuse the people it leaves out."""
        self.assertIn("/etc/jaiabot/ssh/root_authorized_keys > "
                      "/etc/jaiabot/support/allowed_signers.new", self.text)
        self.assertIn("mv /etc/jaiabot/support/allowed_signers.new "
                      "/etc/jaiabot/support/allowed_signers", self.text)

    def test_every_root_key_can_sign_a_request(self):
        """Derived with the same awk the CloudHub runs, so this fails if the two
        ever stop agreeing on what a key line looks like."""
        keys = SOURCE_DIR / "config" / "ssh" / "root_authorized_keys"
        import subprocess
        awk = re.search(r"awk '(.*?)' \\\n", self.text).group(1)
        emitted = subprocess.run(["awk", awk, str(keys)], check=True,
                                 stdout=subprocess.PIPE).stdout.decode().splitlines()
        expected = [line for line in keys.read_text().splitlines()
                    if line.strip() and not line.startswith("#")]
        self.assertEqual(len(expected), len(emitted))
        self.assertTrue(all(line.startswith("jaia-support sk-ssh-ed25519@openssh.com ")
                            for line in emitted))

    def test_the_tool_can_name_every_root_key(self):
        """These two lists drifted once already: a key in the file but not the
        tool is one 'jaia admin ssh add' cannot name."""
        compiled = (SOURCE_DIR / "src" / "bin" / "tool" / "actions" / "admin" / "ssh"
                    / "pubkeys.cpp").read_text()
        keys = SOURCE_DIR / "config" / "ssh" / "root_authorized_keys"
        for line in keys.read_text().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            self.assertIn(line.split()[1], compiled)

    def test_a_grant_expires_with_nobody_acting(self):
        """A firewall rule lasts until something takes it away, so the timer is the
        whole of the expiry mechanism."""
        timer = heredoc(SCRIPT, "/etc/systemd/system/jaia_support_reconcile.timer")
        self.assertIn("OnUnitActiveSec=", timer)
        # a CloudHub switched off over an expiry must not come back still granting
        self.assertIn("OnBootSec=", timer)
        self.assertIn("systemctl enable --now jaia_support_reconcile.timer", self.text)

        unit = heredoc(SCRIPT, "/etc/systemd/system/jaia_support_reconcile.service")
        self.assertIn("ExecStart=/usr/bin/jaia-support-access.py reconcile", unit)
        self.assertIn("Environment=JAIA_FLEET_ID=$jaia_fleet_id", unit)

    def test_ending_a_grant_can_still_reach_the_firewall(self):
        """The portal runs the access script, which drives ufw and the AWS CLI, so
        strict confinement would strand a revocation."""
        unit = heredoc(SCRIPT, "/etc/systemd/system/jaia_support_portal.service")
        self.assertNotIn("ProtectHome", unit)
        self.assertNotIn("ProtectSystem=strict", unit)

    def test_the_cloudhub_still_trusts_the_root_keys(self):
        """Break-glass depends on it: if the directory will not start, the customer
        opens the port from the AWS console and a Yubikey is what gets in."""
        self.assertNotIn("AuthorizedKeysCommand", self.text)
        self.assertNotIn("sshd_config.d", self.text)


class ProvisioningTest(unittest.TestCase):
    """What create_vpc.sh leaves behind: a shut door and the means to open it."""

    @classmethod
    def setUpClass(cls):
        cls.vpc = (SOURCE_DIR / "rootfs" / "cloud" / "aws" / "create_vpc.sh").read_text()
        cls.policy_in = (SOURCE_DIR / "rootfs" / "cloud" / "aws"
                         / "cloudhub-iam-policy.json.in").read_text()

    def policy(self):
        """Rendered as create_vpc.sh renders it. A policy that does not parse is
        refused by IAM, which fails provisioning rather than support."""
        filled = self.policy_in
        for name, value in [("ARN_PREFIX", "arn:aws"), ("REGION", "us-east-1"),
                            ("ACCOUNT_ID", "123456789012"), ("VPC_ID", "vpc-1"),
                            ("CLOUDHUB_DATA_BUCKET", "bucket"),
                            ("SMTP_CREDENTIALS_PARAMETER_ARN", "arn:aws:ssm:::parameter/x"),
                            ("CLOUDHUB_SECURITY_GROUP_ID", "sg-123")]:
            filled = filled.replace("{{" + name + "}}", value)
        return json.loads(filled)

    def test_the_cloudhub_may_edit_its_own_group_and_no_other(self):
        statements = [s for s in self.policy()["Statement"]
                      if set(s["Action"]) >= {"ec2:AuthorizeSecurityGroupIngress",
                                              "ec2:RevokeSecurityGroupIngress"}]
        self.assertEqual(1, len(statements), "expected exactly one such statement")
        self.assertEqual("arn:aws:ec2:us-east-1:123456789012:security-group/sg-123",
                         statements[0]["Resource"])

    def test_the_group_is_created_before_the_policy_that_names_it(self):
        """The policy is written and attached in one go, so a group created after it
        would interpolate as the empty string and scope the statement to nothing."""
        self.assertLess(self.vpc.index("CLOUDHUB_SECURITY_GROUP_ID=$("),
                        self.vpc.index("{{CLOUDHUB_SECURITY_GROUP_ID}}"))

    def test_ssh_is_shut_at_hand_over(self):
        """Open while the script needs a shell, shut before it hands the CloudHub
        over - and shut last, because everything above it needs that shell."""
        closing = self.vpc.index("revoke-security-group-ingress")
        self.assertLess(self.vpc.index("ufw --force enable"), closing)
        self.assertLess(closing, self.vpc.index("Authelia login at"))

    def test_ufw_does_not_hold_the_door_open_either(self):
        """The access script writes a ufw rule per grant, so a standing one would
        leave the gate open on every CloudHub that is not in EC2."""
        self.assertNotIn("ufw allow in on eth0 proto tcp to any port 22", self.vpc)


if __name__ == "__main__":
    unittest.main()
