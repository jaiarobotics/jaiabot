#!/usr/bin/env python3

"""What jaia_configure_authelia.sh would write into LLDAP's bootstrap.

The script installs packages, drives docker and reloads services, so it cannot be
run here. These read what it would write, which is enough for the failure worth
catching: a password in a bootstrap user config is reapplied every time
bootstrap.sh runs, silently replacing one the administrator has since chosen.
"""

import os
import re
import unittest

SOURCE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
SCRIPT = os.path.join(SOURCE_DIR, "src", "sh", "system", "jaia_configure_authelia.sh")


class AutheliaBootstrapTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(SCRIPT) as f:
            cls.text = f.read()

    def jaia_admin_config(self):
        found = re.search(r"jaia_admin\.json <<EOF\n(.*?)^EOF", self.text,
                          re.DOTALL | re.MULTILINE)
        self.assertIsNotNone(found, "the script no longer writes jaia_admin.json")
        return found.group(1)

    def test_the_admin_is_bootstrapped_without_a_password(self):
        self.assertNotIn("password", self.jaia_admin_config())

    def test_the_admin_is_still_created(self):
        config = self.jaia_admin_config()
        self.assertIn('"id": "jaia_admin"', config)
        self.assertIn("lldap_admin", config)

    def test_no_admin_password_is_generated_or_stored(self):
        """It was written only into the bootstrap config, so with that gone it is a
        secret in the secrets file that nothing can use."""
        self.assertNotIn("lldap_admin_password", self.text)


if __name__ == "__main__":
    unittest.main()
