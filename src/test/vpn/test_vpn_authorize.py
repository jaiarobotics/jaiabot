#!/usr/bin/env python3

"""What the bootstrap key may do is one line in one file, and that file is shared.

tmp_authorized_keys also holds whatever temporary keys 'jaia admin ssh add' has
let in, so authorizing enrollment must touch its own entry and no other. Renewing
it has to replace the entry too: a second line for the same key leaves the
expired one behind, and sshd takes the first match it finds.
"""

import datetime
import os
import pathlib
import shutil
import stat
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-authorize.sh"

def keygen(comment):
    """A real key: the script validates with ssh-keygen, so a made-up blob is not
    enough to tell a working line from a rejected one."""
    directory = tempfile.mkdtemp()
    path = os.path.join(directory, comment)
    subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", comment, "-f", path],
                   check=True)
    with open(path + ".pub") as f:
        key = f.read().strip()
    shutil.rmtree(directory, ignore_errors=True)
    return key


BOOTSTRAP_KEY = keygen("id_vpn_tmp")
BOOTSTRAP_BLOB = BOOTSTRAP_KEY.split()[1]

# What 'jaia admin ssh add' leaves in the same file for a person
OPERATOR_ENTRY = 'expiry-time="20991231" ' + keygen("operator@example")


class AuthorizeTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.path = os.path.join(self.dir, "ssh", "tmp_authorized_keys")
        self.env = dict(os.environ, JAIA_TMP_AUTHORIZED_KEYS=self.path)

    def run_script(self, *args):
        return subprocess.run(["bash", str(SCRIPT)] + list(args),
                              capture_output=True, text=True, env=self.env)

    def contents(self):
        if not os.path.exists(self.path):
            return None
        with open(self.path) as f:
            return f.read()

    def seed_operator_key(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w") as f:
            f.write(OPERATOR_ENTRY + "\n")

    def expiry(self, days):
        return (datetime.datetime.now(datetime.timezone.utc) +
                datetime.timedelta(days=days)).strftime("%Y%m%d")

    def test_the_key_is_pinned_to_the_enrollment_command(self):
        result = self.run_script(BOOTSTRAP_KEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        line = self.contents().strip()
        self.assertTrue(line.startswith("restrict,"), line)
        self.assertIn('command="/usr/bin/jaia-vpn-enroll.sh"', line)
        self.assertIn('expiry-time="{}"'.format(self.expiry(30)), line)
        self.assertTrue(line.endswith(BOOTSTRAP_KEY), line)

    def test_the_validity_is_settable(self):
        self.run_script(BOOTSTRAP_KEY, "90")
        self.assertIn('expiry-time="{}"'.format(self.expiry(90)), self.contents())

    def test_other_peoples_temporary_keys_are_left_alone(self):
        self.seed_operator_key()
        self.assertEqual(self.run_script(BOOTSTRAP_KEY).returncode, 0)
        self.assertIn(OPERATOR_ENTRY, self.contents())
        self.assertIn(BOOTSTRAP_BLOB, self.contents())

    def test_renewing_replaces_the_entry(self):
        self.run_script(BOOTSTRAP_KEY, "1")
        self.run_script(BOOTSTRAP_KEY, "60")
        self.assertEqual(self.contents().count(BOOTSTRAP_BLOB), 1)
        self.assertIn('expiry-time="{}"'.format(self.expiry(60)), self.contents())
        self.assertNotIn('expiry-time="{}"'.format(self.expiry(1)), self.contents())

    def test_rm_takes_back_the_authorization_and_nothing_else(self):
        self.seed_operator_key()
        self.run_script(BOOTSTRAP_KEY)
        result = self.run_script("--rm", BOOTSTRAP_KEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(BOOTSTRAP_BLOB, self.contents())
        self.assertIn(OPERATOR_ENTRY, self.contents())

    def test_the_file_is_not_world_readable(self):
        self.run_script(BOOTSTRAP_KEY)
        mode = stat.S_IMODE(os.stat(self.path).st_mode)
        self.assertEqual(mode, 0o600, oct(mode))

    def test_something_that_is_not_a_key_is_refused(self):
        for bad in ("", "ssh-ed25519", "ssh-ed25519 not a key!", "/etc/passwd",
                    'command="/bin/sh" ' + BOOTSTRAP_KEY):
            result = self.run_script(bad)
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(bad))
            self.assertIsNone(self.contents())

    def test_something_that_is_not_a_number_of_days_is_refused(self):
        for bad in ("thirty", "30d", "-1", "$(date)"):
            result = self.run_script(BOOTSTRAP_KEY, bad)
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(bad))
            self.assertNotIn("restrict", self.contents() or "")


if __name__ == "__main__":
    unittest.main()
