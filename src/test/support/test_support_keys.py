#!/usr/bin/env python3

"""A support grant has to end the moment the customer ends it.

The CloudHub resolves Jaia's SSH keys from its own directory rather than from a
file, so that removing jaia_support from the group is the whole of a revocation
- nothing to rewrite, nothing to reload, no cache to outlive the decision. That
only holds if the group is part of the query, so these tests drive the lookup
through a stubbed ldapsearch that records what it was asked and answers what a
granted, revoked or hostile directory would.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-authorized-keys.sh"

ADMIN_PASSWORD = "e3b0c44298fc1c149afbf4c8996fb924"


def keygen(comment):
    directory = tempfile.mkdtemp()
    path = os.path.join(directory, "k")
    subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", comment, "-f", path],
                   check=True)
    with open(path + ".pub") as f:
        key = f.read().strip()
    shutil.rmtree(directory, ignore_errors=True)
    return key


SUPPORT_KEY = keygen("jaia-support-yubikey")


class SupportKeysTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)

        self.secrets = os.path.join(self.dir, "secrets")
        with open(self.secrets, "w") as f:
            f.write("jwt_secret=irrelevant\n"
                    "lldap_admin_password={}\n".format(ADMIN_PASSWORD))

        self.calls = os.path.join(self.dir, "calls")
        self.answer = os.path.join(self.dir, "answer")
        self.set_answer("")

        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        stub = os.path.join(fake_bin, "ldapsearch")
        with open(stub, "w") as f:
            # argv is recorded as given, so a secret passed in it is visible here
            # exactly as it would be to any local process reading /proc
            f.write('#!/bin/sh\n'
                    'echo "$@" >> "$JAIA_TEST_CALLS"\n'
                    'for a in "$@"; do\n'
                    '  case "$a" in /dev/fd/*|/proc/self/fd/*)'
                    ' cat "$a" >> "$JAIA_TEST_CALLS" 2>/dev/null; echo >> "$JAIA_TEST_CALLS" ;;\n'
                    '  esac\n'
                    'done\n'
                    'cat "$JAIA_TEST_ANSWER"\n')
        os.chmod(stub, 0o755)

        self.env = dict(
            os.environ,
            PATH=fake_bin + os.pathsep + os.environ["PATH"],
            JAIA_AUTH_SECRETS=self.secrets,
            JAIA_TEST_CALLS=self.calls,
            JAIA_TEST_ANSWER=self.answer,
        )

    def set_answer(self, text):
        with open(self.answer, "w") as f:
            f.write(text)

    def grant(self, key=SUPPORT_KEY):
        self.set_answer("dn: uid=jaia_support,ou=people,dc=jaia,dc=tech\n"
                        "sshPublicKey: {}\n".format(key))

    def run_script(self, user="jaia"):
        return subprocess.run(["bash", str(SCRIPT), user],
                              capture_output=True, text=True, env=self.env)

    def query(self):
        if not os.path.exists(self.calls):
            return ""
        with open(self.calls) as f:
            return f.read()

    def test_a_granted_key_is_offered(self):
        self.grant()
        result = self.run_script()
        self.assertEqual(result.stdout.strip(), SUPPORT_KEY, result.stderr)

    def test_the_group_is_part_of_the_query(self):
        """Revocation is instant only if the directory does the filtering."""
        self.grant()
        self.run_script()
        self.assertIn("memberOf=cn=jaia_support,ou=groups,dc=jaia,dc=tech", self.query())
        self.assertIn("uid=jaia_support", self.query())

    def test_a_revoked_account_offers_nothing(self):
        """What LLDAP returns once the membership is gone: no entry at all."""
        self.set_answer("")
        result = self.run_script()
        self.assertEqual(result.stdout, "")

    def test_only_the_support_login_is_answered(self):
        self.grant()
        for user in ("root", "ubuntu", "jaia_support", ""):
            result = self.run_script(user)
            self.assertEqual(result.stdout, "", "{} was answered".format(user))
        self.assertEqual(self.query(), "", "the directory was queried for another user")

    def test_the_admin_password_never_reaches_argv(self):
        """ldapsearch -w would put it where every local process can read it."""
        self.grant()
        self.run_script()
        self.assertIn(ADMIN_PASSWORD, self.query(), "the stub did not see the password at all")
        argv = self.query().splitlines()[0]
        self.assertNotIn(ADMIN_PASSWORD, argv)
        self.assertNotIn("-w", argv.split())

    def test_an_entry_carrying_options_is_dropped(self):
        """sshd would honour options in what this prints, so only bare keys pass."""
        self.grant('command="/bin/sh" ' + SUPPORT_KEY)
        result = self.run_script()
        self.assertEqual(result.stdout, "")

    def test_something_that_is_not_a_key_is_dropped(self):
        for bad in ("ssh-ed25519 not-a-key", "/etc/shadow", "ssh-ed25519"):
            self.grant(bad)
            self.assertEqual(self.run_script().stdout, "", "'{}' was offered".format(bad))

    def test_a_base64_encoded_value_is_decoded(self):
        import base64
        self.set_answer("dn: uid=jaia_support,ou=people,dc=jaia,dc=tech\n"
                        "sshPublicKey:: {}\n".format(
                            base64.b64encode(SUPPORT_KEY.encode()).decode()))
        self.assertEqual(self.run_script().stdout.strip(), SUPPORT_KEY)

    def test_nothing_is_offered_without_the_secret(self):
        self.grant()
        os.remove(self.secrets)
        result = self.run_script()
        self.assertEqual(result.stdout, "")
        self.assertEqual(self.query(), "", "the directory was queried with no credentials")


if __name__ == "__main__":
    unittest.main()
