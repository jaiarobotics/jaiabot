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

    def user_config(self, name):
        found = re.search(r"{}\.json <<EOF\n(.*?)^EOF".format(name), self.text,
                          re.DOTALL | re.MULTILINE)
        self.assertIsNotNone(found, "the script no longer writes {}.json".format(name))
        return found.group(1)

    def test_the_admin_is_bootstrapped_without_a_password(self):
        self.assertNotIn("password", self.user_config("admin"))

    def test_the_admin_is_still_created(self):
        config = self.user_config("admin")
        self.assertIn('"id": "admin"', config)
        self.assertIn("lldap_admin", config)

    def test_the_admin_is_not_named_for_jaia(self):
        """It is the customer's own account - their person, their password - and the
        old name said the opposite on the one page built to tell the two apart."""
        self.assertNotIn("jaia_admin", self.text)

    def test_no_admin_password_is_generated_or_stored(self):
        """It was written only into the bootstrap config, so with that gone it is a
        secret in the secrets file that nothing can use."""
        self.assertNotIn("lldap_admin_password", self.text)

    def test_the_support_account_is_bootstrapped_in_no_groups(self):
        """It holds nothing until a grant moves it, so a CloudHub between engagements
        has an account the customer can audit and an account that reaches nothing."""
        config = self.user_config("jaia_support")
        self.assertIn('"id": "jaia_support"', config)
        self.assertNotIn("groups", config)
        self.assertNotIn("password", config)

    def test_the_support_account_carries_no_group_key_at_all(self):
        """An empty "groups" would be bootstrap.sh reapplying "in nothing" over a live
        grant every time it runs; absent means it leaves membership alone."""
        self.assertNotIn('"groups": []', self.user_config("jaia_support"))


if __name__ == "__main__":
    unittest.main()
