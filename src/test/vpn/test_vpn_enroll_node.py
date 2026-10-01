#!/usr/bin/env python3

"""A node mints its own key and keeps the private half.

The service VPN used to hand the node a config the server had generated, private
key and all. The node now generates the pair itself and sends only the public
half, so these tests pin the negative - that nothing the node sends, and nothing
left behind afterwards, carries the private key - and the bootstrap SSH key is
gone whether the enrollment worked or not.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = (SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "jaiabot" /
          "init" / "configure-wireguard-service-vpn.sh")

PLACEHOLDER = "REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

NODE_PRIVKEY = "bm9kZSBwcml2YXRlIGtleSwgbXVzdCBub3QgbGVhdmU="
NODE_PUBKEY = "bm9kZSBwdWJsaWMga2V5IGZvciB0aGUgdGVzdHMhIQ=="
SERVER_PUBKEY = "Y2xvdWRodWIgcHVibGljIGtleSBmb3IgdGVzdHMhIQ=="

CLOUDHUB_ANSWER = """[Interface]
PrivateKey = {}
Address = fd0f:77ac:4fdf:7::203/128

[Peer]
PublicKey = {}
AllowedIPs = fd0f:77ac:4fdf:7::/64
Endpoint = 203.0.113.7:51821
PersistentKeepalive = 52
""".format(PLACEHOLDER, SERVER_PUBKEY)

STUBS = {
    "sudo": 'exec "$@"\n',
    "mount": 'echo "mount $*" >> "$JAIA_TEST_CALLS"\n',
    "chown": 'echo "chown $*" >> "$JAIA_TEST_CALLS"\n',
    "ping": 'exit 0\n',
    "wg": """
case "$1" in
    genkey) echo "%(priv)s" ;;
    pubkey) cat > /dev/null; echo "%(pub)s" ;;
esac
""" % {"priv": NODE_PRIVKEY, "pub": NODE_PUBKEY},
    "ssh": """
echo "ssh $*" >> "$JAIA_TEST_CALLS"
cat "$JAIA_TEST_ANSWER"
exit ${JAIA_TEST_SSH_STATUS:-0}
""",
}


class NodeEnrollTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)

        self.boot = os.path.join(self.dir, "boot")
        self.ssh_dir = os.path.join(self.dir, "ssh")
        self.wg_dir = os.path.join(self.dir, "wireguard")
        os.makedirs(os.path.join(self.boot, "jaiabot", "init"))
        os.makedirs(self.ssh_dir)
        os.makedirs(self.wg_dir)

        self.bootstrap_key = os.path.join(self.boot, "jaiabot", "init", "id_vpn_tmp")
        self.moved_key = os.path.join(self.ssh_dir, "id_vpn_tmp")
        with open(self.bootstrap_key, "w") as f:
            f.write("-----BEGIN OPENSSH PRIVATE KEY-----\nbootstrap\n")

        debconf = os.path.join(self.dir, "jaia-debconf.sh")
        with open(debconf, "w") as f:
            f.write("jaia_debconf_get() { case $1 in type) echo bot ;; fleet_id) echo 7 ;; esac; }\n"
                    "jaia_debconf_node_id() { echo 3; }\n")

        self.answer = os.path.join(self.dir, "answer")
        self.write_answer(CLOUDHUB_ANSWER)

        self.calls = os.path.join(self.dir, "calls")
        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        for name, body in STUBS.items():
            path = os.path.join(fake_bin, name)
            with open(path, "w") as f:
                f.write("#!/bin/sh\n" + body)
            os.chmod(path, 0o755)

        self.env = dict(
            os.environ,
            PATH=fake_bin + os.pathsep + os.environ["PATH"],
            JAIA_BOOT_DIR=self.boot,
            JAIA_SSH_DIR=self.ssh_dir,
            JAIA_WG_DIR=self.wg_dir,
            JAIA_DEBCONF_SH=debconf,
            JAIA_TEST_CALLS=self.calls,
            JAIA_TEST_ANSWER=self.answer,
        )

    def write_answer(self, text):
        with open(self.answer, "w") as f:
            f.write(text)

    def run_script(self, host="fleet7.jaia.tech"):
        return subprocess.run(["bash", str(SCRIPT), host],
                              capture_output=True, text=True, env=self.env)

    def recorded(self):
        if not os.path.exists(self.calls):
            return ""
        with open(self.calls) as f:
            return f.read()

    def installed_config(self):
        path = os.path.join(self.wg_dir, "wg_jaia_ch7.conf")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return f.read()

    def test_the_cloudhub_is_told_the_public_key_only(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("jaia@fleet7.jaia.tech bot 3 " + NODE_PUBKEY, self.recorded())
        self.assertNotIn(NODE_PRIVKEY, self.recorded())

    def test_the_node_puts_its_own_key_into_the_config(self):
        self.assertEqual(self.run_script().returncode, 0)
        config = self.installed_config()
        self.assertIn("PrivateKey = " + NODE_PRIVKEY, config)
        self.assertNotIn(PLACEHOLDER, config)
        self.assertIn(SERVER_PUBKEY, config)

    def test_an_existing_key_is_kept(self):
        """Re-running must not change the identity the CloudHub already knows."""
        for name, value in (("privatekey", "a" * 43 + "="), ("publickey", "b" * 43 + "=")):
            with open(os.path.join(self.wg_dir, name), "w") as f:
                f.write(value + "\n")
        self.assertEqual(self.run_script().returncode, 0)
        self.assertIn("jaia@fleet7.jaia.tech bot 3 " + "b" * 43 + "=", self.recorded())
        self.assertIn("PrivateKey = " + "a" * 43 + "=", self.installed_config())

    def test_an_answer_that_is_not_a_config_is_not_installed(self):
        self.write_answer("Permission denied (publickey).\n")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(self.installed_config())

    def test_enrolling_spends_the_bootstrap_key(self):
        self.assertEqual(self.run_script().returncode, 0)
        self.assertFalse(os.path.exists(self.bootstrap_key))
        self.assertFalse(os.path.exists(self.moved_key))

    def test_a_failed_attempt_leaves_the_key_for_another_try(self):
        """The authorization on the CloudHub expires, so a node imaged long after the
        fleet was set up is refused. Burning the key then would mean re-imaging it."""
        self.write_answer("Permission denied (publickey).\n")
        self.assertNotEqual(self.run_script().returncode, 0)
        self.assertTrue(os.path.exists(self.moved_key))

    def test_a_node_that_was_refused_can_be_run_again(self):
        self.write_answer("Permission denied (publickey).\n")
        self.assertNotEqual(self.run_script().returncode, 0)
        self.write_answer(CLOUDHUB_ANSWER)
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        config = self.installed_config()
        self.assertIsNotNone(config, "the second attempt did not find the key left behind")
        self.assertIn("PrivateKey = " + NODE_PRIVKEY, config)
        self.assertFalse(os.path.exists(self.moved_key))

    def test_nothing_happens_without_a_cloudhub(self):
        result = self.run_script("")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded(), "")
        self.assertTrue(os.path.exists(self.bootstrap_key))

    def test_nothing_happens_without_a_bootstrap_key(self):
        os.remove(self.bootstrap_key)
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded(), "")
        self.assertIsNone(self.installed_config())


if __name__ == "__main__":
    unittest.main()
