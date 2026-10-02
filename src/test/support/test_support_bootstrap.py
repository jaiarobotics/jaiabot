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


if __name__ == "__main__":
    unittest.main()
