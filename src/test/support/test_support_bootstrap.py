#!/usr/bin/env python3

"""The directory has to carry the support account before anything can grant it.

jaia_configure_authelia.sh cannot be run here - it installs packages, drives
docker and reloads services - so these tests read what it would write. That is
narrow, but it covers the failure that is both most likely and quietest: LLDAP's
bootstrap skips a schema file it cannot parse, leaving sshPublicKey absent and
every support login refused with nothing in the directory to show why.
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

    def test_the_ssh_key_attribute_is_a_multi_valued_string(self):
        """A person has more than one Yubikey, so a single-valued attribute would
        quietly keep only the last one written."""
        schema = json.loads(heredoc(SCRIPT, "/etc/lldap/bootstrap/user-schemas/sshPublicKey.json"))
        self.assertEqual(schema["name"], "sshPublicKey")
        self.assertEqual(schema["attributeType"], "STRING")
        self.assertIs(schema["isList"], True)
        self.assertIs(schema["isEditable"], True)
        self.assertIs(schema["isVisible"], True)

    def test_the_schema_lands_where_bootstrap_looks_for_it(self):
        """USER_SCHEMAS_DIR is not set in the compose file, so bootstrap.sh's own
        default has to be what the script writes to, under the existing mount."""
        self.assertIn("mkdir -p /etc/lldap/bootstrap/user-schemas", self.text)
        self.assertIn('"/etc/lldap/bootstrap:/bootstrap"', self.text)

    def test_the_support_account_is_in_no_group(self):
        """It exists to be granted. Carrying a group would grant it on every boot,
        and an empty list could read as an instruction to take one away."""
        user = json.loads(heredoc(SCRIPT, "/etc/lldap/bootstrap/user-configs/jaia_support.json"))
        self.assertEqual(user["id"], "jaia_support")
        self.assertNotIn("groups", user)

    def test_the_support_group_exists_to_be_granted(self):
        groups = re.search(r"^groups=\((.*?)^\)", self.text, re.DOTALL | re.MULTILINE).group(1)
        self.assertIn("jaia_support", groups.split())

    def test_an_already_bootstrapped_cloudhub_picks_up_the_new_entries(self):
        """The old guard recorded that bootstrap ran, not what it created, so a
        CloudHub in the field would never see an entry added later."""
        self.assertIn("sed -i '/^jaia_auth_lldap_bootstrap_completed=/d' /etc/jaiabot/cloud.env",
                      self.text)
        self.assertIn("lldap_bootstrap_generation=1", self.text)
        self.assertIn("jaia_auth_lldap_bootstrap_generation", self.text)

    def test_the_key_lookup_is_confined_to_the_cloudhub(self):
        """The image's own sshd config is shared with every bot and hub, where this
        directory is across the link you would be logging in to repair."""
        shared = (SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "ssh" /
                  "sshd_config.d" / "jaia_sshd.conf").read_text()
        self.assertNotIn("AuthorizedKeysCommand", shared)
        self.assertIn("/etc/ssh/sshd_config.d/jaia_support.conf", self.text)
        self.assertIn("AuthorizedKeysCommand /usr/bin/jaia-support-authorized-keys.sh %u",
                      self.text)

    def test_the_support_portal_is_behind_the_login(self):
        """It trusts whoever reaches it, so serving the site without the forward
        auth would hand the decision to anyone who can resolve the name."""
        site = re.search(r"\nsupport\.\$base_uri \{(.*?)\n\}", self.text, re.DOTALL)
        self.assertIsNotNone(site)
        self.assertIn("import authelia_forward_auth", site.group(1))
        self.assertIn("reverse_proxy :$support_portal_port", site.group(1))

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


if __name__ == "__main__":
    unittest.main()
