#!/usr/bin/env python3

"""The CloudHub's inventory follows its VPN peers.

A CloudHub is built from a fleet config that may not list nodes paired later,
and its JCU acts only on the hosts in /etc/jaiabot/inventory.yml. Enrolment is
when it learns of a node, so enrolling rewrites the inventory from the peers.
"""

import os
import shutil
import subprocess
import unittest

from test_vpn_gen import Env, GENERATOR, NODE_PUBKEY, SOURCE_DIR

ENROLL = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-enroll.sh"
INVENTORY_SCRIPT = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-inventory.sh"
PEERS = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-peers.sh"
CREATE_INVENTORY = (SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "jaiabot"
                    / "init" / "jaia-create-ansible-inventory.sh")

OTHER_PUBKEY = "YW5vdGhlciBub2RlIGtleSBhZnRlciByZWltYWdpbmc="


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)
        self.env.seed_server_config("wg_cloudhub")
        for script in (GENERATOR, INVENTORY_SCRIPT, CREATE_INVENTORY):
            target = os.path.join(self.env.dir, "bin", script.name)
            shutil.copyfile(script, target)
            os.chmod(target, 0o755)
        self.inventory = os.path.join(self.env.dir, "inventory.yml")
        self.env.env["JAIA_INVENTORY"] = self.inventory

    def enroll(self, node_type, node_id, pubkey=NODE_PUBKEY):
        env = dict(self.env.env, SSH_ORIGINAL_COMMAND="{} {} {}".format(node_type, node_id, pubkey))
        return subprocess.run(["bash", str(ENROLL)], capture_output=True, text=True, env=env)

    def hosts(self):
        with open(self.inventory) as f:
            return [line.strip().rstrip(":") for line in f if line.startswith("    ") and
                    not line.startswith("      ")]

    def test_a_new_cloudhub_lists_only_itself(self):
        result = subprocess.run(["bash", str(INVENTORY_SCRIPT)], capture_output=True, text=True,
                                env=self.env.env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.hosts(), ["hub30-fleet7"])

    def test_enrolling_adds_the_node(self):
        self.assertEqual(self.enroll("bot", 3).returncode, 0)
        self.assertEqual(self.enroll("hub", 1).returncode, 0)
        self.assertEqual(self.hosts(), ["bot3-fleet7", "hub1-fleet7", "hub30-fleet7"])

    def test_hosts_are_reached_over_the_cloudhub_vpn(self):
        self.enroll("bot", 3)
        with open(self.inventory) as f:
            self.assertIn("ansible_host: fd0f:77ac:4fdf:7::", f.read())

    def test_enrolling_again_does_not_duplicate_the_node(self):
        self.enroll("bot", 3)
        self.assertEqual(self.enroll("bot", 3, OTHER_PUBKEY).returncode, 0)
        self.assertEqual(self.hosts(), ["bot3-fleet7", "hub30-fleet7"])

    def test_ids_are_in_numeric_order(self):
        for bot in (10, 2, 1):
            self.enroll("bot", bot)
        self.assertEqual(self.hosts()[:3], ["bot1-fleet7", "bot2-fleet7", "bot10-fleet7"])

    def test_other_peers_are_not_fleet_nodes(self):
        """The workstation's client peer is on the same interface."""
        os.makedirs(os.path.join(self.env.wg_dir, "wg_cloudhub.peers.d"), exist_ok=True)
        with open(os.path.join(self.env.wg_dir, "wg_cloudhub.peers.d", "desktop1.conf"), "w") as f:
            f.write("[Peer]\nPublicKey = {}\nAllowedIPs = fd0f:77ac:4fdf:7::3:1/128\n".format(OTHER_PUBKEY))
        self.enroll("bot", 3)
        self.assertEqual(self.hosts(), ["bot3-fleet7", "hub30-fleet7"])

    def test_a_failed_inventory_does_not_cost_the_node_its_pairing(self):
        with open(os.path.join(self.env.dir, "bin", "jaia-create-ansible-inventory.sh"), "w") as f:
            f.write("#!/bin/sh\nexit 1\n")
        result = self.enroll("bot", 3)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PrivateKey", result.stdout)
        self.assertIn("could not update the CloudHub's inventory", result.stderr)


class StatusTest(unittest.TestCase):
    """What "Check CloudHub VPN Status" shows on the CloudHub."""

    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)
        self.env.seed_server_config("wg_cloudhub")
        peers_dir = os.path.join(self.env.wg_dir, "wg_cloudhub.peers.d")
        os.makedirs(peers_dir)
        for name, key in (("bot3", NODE_PUBKEY), ("hub1", OTHER_PUBKEY)):
            with open(os.path.join(peers_dir, name + ".conf"), "w") as f:
                f.write("[Peer]\nPublicKey = {}\nAllowedIPs = fd0f::/128\n".format(key))

    def status(self, handshakes):
        wg = os.path.join(self.env.dir, "bin", "wg")
        with open(wg, "w") as f:
            f.write("#!/bin/sh\n[ \"$3\" = latest-handshakes ] || exit 1\ncat <<'EOF'\n{}EOF\n".format(
                "".join("{}\t{}\n".format(k, t) for k, t in handshakes)))
        os.chmod(wg, 0o755)
        return subprocess.run(["bash", str(PEERS), "status", "wg_cloudhub"], capture_output=True,
                              text=True, env=self.env.env)

    def test_each_peer_with_its_last_handshake(self):
        result = self.status([(NODE_PUBKEY, "1"), (OTHER_PUBKEY, "0")])
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.splitlines()
        self.assertEqual([line.split()[0] for line in lines], ["bot3", "hub1"])
        self.assertRegex(lines[0], r"^bot3 \d+s ago$")
        self.assertEqual(lines[1], "hub1 never")

    def test_an_interface_that_is_down_shows_every_peer_as_never(self):
        result = self.status([])
        self.assertEqual(result.stdout.splitlines(), ["bot3 never", "hub1 never"])


if __name__ == "__main__":
    unittest.main()
