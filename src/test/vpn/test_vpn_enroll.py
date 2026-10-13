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


class EnrollTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)
        self.env.seed_server_config("wg_cloudhub")
        # the forced command finds the generator on PATH, as it does on a CloudHub
        shutil.copyfile(GENERATOR, os.path.join(self.env.dir, "bin", "jaia-vpn-gen.sh"))
        os.chmod(os.path.join(self.env.dir, "bin", "jaia-vpn-gen.sh"), 0o755)

    def enroll(self, request):
        env = dict(self.env.env, SSH_ORIGINAL_COMMAND=request)
        import subprocess
        return subprocess.run(["bash", str(ENROLL)], capture_output=True, text=True, env=env)

    def test_the_node_gets_its_config_and_nothing_else(self):
        result = self.enroll("bot 3 " + NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, self.env.client_config("bot3", "wg_jaia_ch7"))
        self.assertIn("PrivateKey = " + PLACEHOLDER, result.stdout)
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

    def test_a_reimaged_node_may_enroll_again(self):
        """Re-flashing a bot gives it a new key, and the directory refuses to add a
        peer that is already there, so enrolling twice has to replace it."""
        self.assertEqual(self.enroll("bot 3 " + NODE_PUBKEY).returncode, 0)
        result = self.enroll("bot 3 " + OTHER_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        fragment = self.env.peer_fragment("wg_cloudhub", "bot3")
        self.assertIn(OTHER_PUBKEY, fragment)
        self.assertNotIn(NODE_PUBKEY, fragment)


if __name__ == "__main__":
    unittest.main()
