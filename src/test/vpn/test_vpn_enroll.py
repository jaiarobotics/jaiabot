#!/usr/bin/env python3

"""The bootstrap SSH key is on every node's boot media, so what it can ask for
bounds what reading one node's disk is worth.

It is authorized on the CloudHub with command="jaia-vpn-enroll.sh", which takes
the request as a string in SSH_ORIGINAL_COMMAND. These tests pin what that
string may do: name one bot or hub and a public key, and nothing else - no
shell, no path, no other interface - and get back a config and nothing more.
"""

import os
import shutil
import unittest

from test_vpn_gen import Env, GENERATOR, NODE_PUBKEY, PLACEHOLDER, SOURCE_DIR

ENROLL = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-enroll.sh"

OTHER_PUBKEY = "YW5vdGhlciBub2RlIGtleSBhZnRlciByZWltYWdpbmc="
CLOUDHUB_SSH_PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC1vdWRodWIgc3NoIGtleSBmb3IgdGhlIHRlc3Rz hub30_fleet7"
CLOUDHUB_SSH_SECRET = "cloudhub ssh secret half, never sent\n"


class EnrollTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)
        self.env.seed_server_config("wg_cloudhub")
        # the forced command finds the generator on PATH, as it does on a CloudHub
        shutil.copyfile(GENERATOR, os.path.join(self.env.dir, "bin", "jaia-vpn-gen.sh"))
        os.chmod(os.path.join(self.env.dir, "bin", "jaia-vpn-gen.sh"), 0o755)
        # the CloudHub's hub id, which the shared stub (made for the fleet bounds) does not know
        bounds = os.path.join(self.env.dir, "bin", "jaia_bounds")
        with open(bounds, "w") as f:
            f.write('#!/bin/sh\ncase "$1" in --cloudhub_id) echo 30 ;; --iridium_id) echo 25 ;; *) echo 250 ;; esac\n')
        os.chmod(bounds, 0o755)
        self.ssh_dir = os.path.join(self.env.dir, "ssh")
        os.makedirs(self.ssh_dir)

    def give_the_cloudhub_a_key(self):
        with open(os.path.join(self.ssh_dir, "hub30_fleet7.pub"), "w") as f:
            f.write(CLOUDHUB_SSH_PUBKEY + "\n")
        with open(os.path.join(self.ssh_dir, "hub30_fleet7"), "w") as f:
            f.write(CLOUDHUB_SSH_SECRET)

    def assert_client_config(self, text, address="fd0f:77ac:4fdf:7::203/128"):
        """The client config jaia-vpn-gen.sh writes, and only that: the reply's whole
        text, which the node installs as its tunnel."""
        self.assertTrue(text.startswith("[Interface]\n"), text)
        self.assertIn("PrivateKey = " + PLACEHOLDER + "\n", text)
        self.assertIn("Address = " + address + "\n", text)
        self.assertIn("[Peer]\n", text)
        self.assertIn("Endpoint = 203.0.113.7:51821\n", text)
        self.assertTrue(text.endswith("PersistentKeepalive = 52\n"), text)

    def enroll(self, request):
        env = dict(self.env.env, SSH_ORIGINAL_COMMAND=request, JAIA_SSH_DIR=self.ssh_dir)
        import subprocess
        return subprocess.run(["bash", str(ENROLL)], capture_output=True, text=True, env=env)

    def test_the_node_gets_its_config_and_nothing_else(self):
        result = self.enroll("bot 3 " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_client_config(result.stdout)
        self.assertIn(NODE_PUBKEY, self.env.peer_fragment("wg_cloudhub", "bot3"))

    def test_the_request_may_only_be_three_words(self):
        for request in ("", "bot 3", "cat /etc/shadow", "bot 3 {} extra".format(NODE_PUBKEY),
                        "bot 3 {}; cat /etc/shadow".format(NODE_PUBKEY)):
            result = self.enroll(request)
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(request))
            self.assertIsNone(self.env.peer_fragment("wg_cloudhub", "bot3"))

    def test_only_a_bot_or_a_hub_may_enroll(self):
        for node_type in ("desktop", "gateway", "../hub", "bot hub"):
            result = self.enroll("{} 3 {}".format(node_type, NODE_PUBKEY))
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(node_type))

    def test_the_node_id_must_be_a_number(self):
        for node_id in ("../../root", "3;4", "-1", "", "0x3"):
            result = self.enroll("bot {} {}".format(node_id, NODE_PUBKEY))
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(node_id))

    def test_a_malformed_key_leaves_no_peer_behind(self):
        result = self.enroll("bot 3 not-a-key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(self.env.peer_fragment("wg_cloudhub", "bot3"))

    def test_the_answer_carries_the_cloudhubs_ssh_key(self):
        """A rebuilt CloudHub has a new key; the node learns it here, restricted to the
        CloudHub's VPN address as its fleet config restricts it, on a line wg-quick
        reads as a comment should an older node install it unstripped."""
        self.give_the_cloudhub_a_key()
        result = self.enroll("bot 3 " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        config, marker, rest = result.stdout.partition("# jaia-cloudhub-ssh-key")
        self.assert_client_config(config)
        extra = marker + rest
        self.assertEqual(extra, '# jaia-cloudhub-ssh-key: from="fd0f:77ac:4fdf:7::203" {}\n'.format(
            CLOUDHUB_SSH_PUBKEY))
        self.assertNotIn("never sent", result.stdout)

    def test_a_cloudhub_without_its_key_still_enrolls_the_node(self):
        result = self.enroll("bot 3 " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_client_config(result.stdout)
        self.assertIn("WARNING", result.stderr)

    def test_a_reimaged_node_may_enroll_again(self):
        """Re-flashing a bot gives it a new key, and the directory refuses to add a
        peer that is already there, so enrolling twice has to replace it."""
        self.assertEqual(self.enroll("bot 3 " + NODE_PUBKEY).returncode, 0)
        result = self.enroll("bot 3 " + OTHER_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        fragment = self.env.peer_fragment("wg_cloudhub", "bot3")
        self.assertIn(OTHER_PUBKEY, fragment)
        self.assertNotIn(NODE_PUBKEY, fragment)

    def test_iridium_enrolls_as_its_hub_id_without_the_cloudhubs_key(self):
        """iridium.jaia.tech relays the fleet's Iridium messages; the CloudHub never
        acts on it, so it gets its config and nothing else."""
        self.give_the_cloudhub_a_key()
        result = self.enroll("iridium " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_client_config(result.stdout)
        self.assertIn(NODE_PUBKEY, self.env.peer_fragment("wg_cloudhub", "hub25"))
        self.assertNotIn("jaia-cloudhub-ssh-key", result.stdout)

    def test_iridium_takes_only_a_key(self):
        for request in ("iridium", "iridium 3 " + NODE_PUBKEY, "iridium not-a-key"):
            result = self.enroll(request)
            self.assertNotEqual(result.returncode, 0, "'{}' was accepted".format(request))
        self.assertIsNone(self.env.peer_fragment("wg_cloudhub", "hub25"))

    def test_a_directory_left_by_another_user_does_not_stop_enrollment(self):
        """A hand run of jaia-vpn-gen.sh as root once left /tmp/hub25 behind, and the
        forced command, running as jaia, could not write its reply there."""
        blocked = os.path.join(self.env.out_dir, "bot3")
        os.makedirs(blocked)
        os.chmod(blocked, 0o500)
        self.addCleanup(os.chmod, blocked, 0o700)
        result = self.enroll("bot 3 " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("[Interface]", result.stdout)

    def test_nothing_is_left_behind(self):
        before = set(os.listdir(self.env.out_dir))
        self.assertEqual(self.enroll("bot 3 " + NODE_PUBKEY).returncode, 0)
        self.assertEqual(set(os.listdir(self.env.out_dir)), before)


if __name__ == "__main__":
    unittest.main()
