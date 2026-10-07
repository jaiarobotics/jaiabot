#!/usr/bin/env python3

"""What jaia_configure_authelia.sh would write into LLDAP's bootstrap.

The script installs packages, drives docker and reloads services, so it cannot be
run here. Most of these read what it would write, which is enough for the failure
worth catching: a password in a bootstrap user config is reapplied every time
bootstrap.sh runs, silently replacing one the administrator has since chosen. The
guard on Jaia's commissioning account is run for real, since what it must prevent -
the account coming back after it was deleted - is a matter of behaviour, not text.
"""

import os
import re
import shutil
import subprocess
import tempfile
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
        # Anchored on the directory, or asking for "admin" would match fleet_admin.json
        found = re.search(r"user-configs/{}\.json <<EOF\n(.*?)^EOF".format(name), self.text,
                          re.DOTALL | re.MULTILINE)
        self.assertIsNotNone(found, "the script no longer writes {}.json".format(name))
        return found.group(1)

    def test_the_admin_is_bootstrapped_without_a_password(self):
        self.assertNotIn("password", self.user_config("fleet_admin"))

    def test_the_admin_is_still_created(self):
        config = self.user_config("fleet_admin")
        self.assertIn('"id": "fleet_admin"', config)
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

    ## jaia_bootstrap: Jaia's commissioning account, made once and never again

    def jaia_bootstrap_config(self):
        found = re.search(r'"\$jaia_bootstrap_config" <<EOF\n(.*?)^EOF', self.text,
                          re.DOTALL | re.MULTILINE)
        self.assertIsNotNone(found, "the script no longer writes jaia_bootstrap.json")
        return found.group(1)

    def test_jaia_bootstrap_can_commission_the_cloudhub(self):
        """Testing and pairing need every site, and deleting itself needs the directory."""
        config = self.jaia_bootstrap_config()
        self.assertIn('"id": "jaia_bootstrap"', config)
        self.assertIn("super_admin", config)
        self.assertIn("lldap_admin", config)
        self.assertNotIn("password", config)

    def test_jaia_bootstrap_does_not_share_an_email(self):
        """LLDAP holds emails unique, so a shared one would fail the whole bootstrap and
        with it the CloudHub's first boot."""
        email = re.compile(r'"email": "([^"]+)"')
        mine = email.search(self.jaia_bootstrap_config()).group(1)
        support = email.search(self.user_config("jaia_support")).group(1)
        self.assertNotEqual(mine, support)

    def run_guard(self, bootstrapped_before=False, marker=False, then_bootstrap=False):
        """The account's guard as the script runs it, against a scratch directory."""
        start = self.text.index("jaia_bootstrap_marker=")
        end = self.text.index("cat > /etc/lldap/bootstrap/user-configs/jaia_support.json")
        work = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, work, True)
        configs = os.path.join(work, "user-configs")
        persistent = os.path.join(work, "auth")
        os.makedirs(configs)
        if marker:
            os.makedirs(persistent)
            open(os.path.join(persistent, "jaia_bootstrap_created"), "w").close()
        block = self.text[start:end].replace("/etc/lldap/bootstrap/user-configs", configs)
        success = re.search(r"then\n(\s+echo \"jaia_auth_lldap_bootstrap_completed=true\".*?)\s+break",
                            self.text, re.DOTALL).group(1)
        success = success.replace("/etc/jaiabot/cloud.env", os.path.join(work, "cloud.env"))
        script = "set -e\nauth_persistent_dir={}\njaia_auth_lldap_bootstrap_completed={}\n{}\n{}\n".format(
            persistent, "true" if bootstrapped_before else "false", block,
            success if then_bootstrap else "")
        subprocess.run(["bash", "-c", script], check=True)
        return (os.path.exists(os.path.join(configs, "jaia_bootstrap.json")),
                os.path.exists(os.path.join(persistent, "jaia_bootstrap_created")))

    def test_a_new_cloudhub_is_given_jaia_bootstrap(self):
        written, marked = self.run_guard()
        self.assertTrue(written)

    def test_once_bootstrapped_it_is_recorded_and_its_config_removed(self):
        written, marked = self.run_guard(then_bootstrap=True)
        self.assertFalse(written)
        self.assertTrue(marked)

    def test_after_a_major_upgrade_a_deleted_jaia_bootstrap_stays_deleted(self):
        """The upgrade replaces cloud.env, so bootstrap.sh runs again; the marker is in
        the persistent directory, which the upgrade keeps, and stops it coming back."""
        written, marked = self.run_guard(bootstrapped_before=False, marker=True)
        self.assertFalse(written)

    def test_a_cloudhub_that_bootstrapped_before_the_account_existed_never_gets_it(self):
        written, marked = self.run_guard(bootstrapped_before=True)
        self.assertFalse(written)
        self.assertTrue(marked)


if __name__ == "__main__":
    unittest.main()
