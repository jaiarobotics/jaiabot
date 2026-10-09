#!/usr/bin/env python3

"""A node's private key must not be minted anywhere but on that node.

The generator used to run 'wg genkey' on the server, write the finished client
config to /tmp with the private half in it, and tell whoever ran it to move that
file to the node; on the service VPN the node fetched it over SSH itself. The
key the node authenticates with therefore existed on at least two machines and
crossed the network between them.

It now takes the node's public key instead. These tests pin the negative - that
no path which was given a public key generates a key or writes one out - so a
stubbed wg records every call rather than returning something plausible.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
GENERATOR = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-gen.sh"
PEERS = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-peers.sh"

PLACEHOLDER = "REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

# 44 characters, the size wg(8) prints
NODE_PUBKEY = "bm9kZSBwdWJsaWMga2V5IGZvciB0aGUgdGVzdHMhIQ=="
SERVER_PUBKEY = "c2VydmVyIHB1YmxpYyBrZXkgZm9yIHRoZSB0ZXN0cyE="
SERVER_PRIVKEY = "c2VydmVyIHByaXZhdGUga2V5LCBuZXZlciBleHBvcnQ="

# What the stub hands back if anything asks it to mint a key, so that a leak of
# a generated key is searchable rather than merely absent-looking.
MINTED_PRIVKEY = "TUlOVEVEIEJZIFRIRSBTRVJWRVIsIFNIT1VMRCBOT1Q="
MINTED_PUBKEY = "cHVibGljIGhhbGYgb2YgdGhlIG1pbnRlZCBwcml2YXRl"

STUBS = {
    "sudo": 'exec "$@"\n',
    "systemctl": 'echo "systemctl $*" >> "$JAIA_TEST_CALLS"\n',
    "wg-quick": 'echo "wg-quick $*" >> "$JAIA_TEST_CALLS"\nexit 0\n',
    "wg": """
echo "wg $*" >> "$JAIA_TEST_CALLS"
case "$1" in
    genkey) echo "%(minted_priv)s" ;;
    pubkey) cat > /dev/null; echo "%(minted_pub)s" ;;
    show) exit 1 ;;
esac
exit 0
""" % {"minted_priv": MINTED_PRIVKEY, "minted_pub": MINTED_PUBKEY},
    "jaia_ip": """
case "$*" in
    *"--query_type net"*) echo "fd0f:77ac:4fdf:7::/64" ;;
    *"--query_type addr"*) echo "fd0f:77ac:4fdf:7::203" ;;
    *) echo "fd0f:77ac:4fdf:7::1e" ;;
esac
""",
    "jaia_bounds": 'echo 250\n',
}


class Env:
    """Scratch /etc/wireguard, cloud.env and output directory, with the tools the
    generator shells out to replaced by recording stubs."""

    def __init__(self, fleet_id=7):
        self.dir = tempfile.mkdtemp()
        self.wg_dir = os.path.join(self.dir, "wireguard")
        self.out_dir = os.path.join(self.dir, "out")
        os.makedirs(self.wg_dir, mode=0o700)
        os.makedirs(self.out_dir)

        for name, value in (("privatekey", SERVER_PRIVKEY), ("publickey", SERVER_PUBKEY)):
            with open(os.path.join(self.wg_dir, name), "w") as f:
                f.write(value + "\n")

        self.cloud_env = os.path.join(self.dir, "cloud.env")
        with open(self.cloud_env, "w") as f:
            f.write("jaia_fleet_id={}\n".format(fleet_id))
            f.write("jaia_cloudhub_public_ipv4_address=203.0.113.7\n")

        self.calls = os.path.join(self.dir, "calls")
        self.sysctl_dir = os.path.join(self.dir, "sysctl.d")
        self.systemd_dir = os.path.join(self.dir, "systemd")
        os.makedirs(self.sysctl_dir)

        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        for name, body in STUBS.items():
            path = os.path.join(fake_bin, name)
            with open(path, "w") as f:
                f.write("#!/bin/sh\n" + body)
            os.chmod(path, 0o755)
        # the real one, so that what the generator hands it is what gets stored
        shutil.copyfile(PEERS, os.path.join(fake_bin, "jaia-vpn-peers.sh"))
        os.chmod(os.path.join(fake_bin, "jaia-vpn-peers.sh"), 0o755)

        self.env = dict(
            os.environ,
            PATH=fake_bin + os.pathsep + os.environ["PATH"],
            JAIA_WG_DIR=self.wg_dir,
            JAIA_CLOUD_ENV=self.cloud_env,
            JAIA_VPN_OUT_DIR=self.out_dir,
            JAIA_TEST_CALLS=self.calls,
            JAIA_SYSCTL_DIR=self.sysctl_dir,
            JAIA_SYSTEMD_DIR=self.systemd_dir,
        )

    def run(self, *args):
        return subprocess.run(["bash", str(GENERATOR)] + list(args),
                              capture_output=True, text=True, env=self.env)

    def seed_server_config(self, interface):
        """The interface-only config server_init leaves behind."""
        path = os.path.join(self.wg_dir, interface + ".conf")
        with open(path, "w") as f:
            f.write("[Interface]\nListenPort = 51821\nPrivateKey = {}\n"
                    "PostUp = jaia-vpn-peers.sh apply %i\n".format(SERVER_PRIVKEY))
        os.chmod(path, 0o600)

    def client_config(self, node, interface):
        path = os.path.join(self.out_dir, node, interface + ".conf")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return f.read()

    def peer_fragment(self, interface, name):
        path = os.path.join(self.wg_dir, interface + ".peers.d", name + ".conf")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return f.read()

    def everything_written(self):
        """Every byte this run left on disk, to search for a leaked key."""
        text = []
        for root, _, files in os.walk(self.dir):
            if os.path.basename(root) == "bin":
                continue
            for name in files:
                try:
                    with open(os.path.join(root, name)) as f:
                        text.append(f.read())
                except (OSError, UnicodeDecodeError):
                    pass
        return "\n".join(text)

    def recorded(self):
        if not os.path.exists(self.calls):
            return []
        with open(self.calls) as f:
            return [line.strip() for line in f if line.strip()]

    def cleanup(self):
        shutil.rmtree(self.dir, ignore_errors=True)


class GeneratorTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)

    def assertMintedNothing(self):
        self.assertNotIn(
            "wg genkey", self.env.recorded(),
            "the server generated a private key for a node that supplied its own")
        self.assertNotIn(
            MINTED_PRIVKEY, self.env.everything_written(),
            "a server-generated private key was written to disk")


class CloudHubTest(GeneratorTest):
    def setUp(self):
        super().setUp()
        self.env.seed_server_config("wg_cloudhub")

    def add(self, *extra):
        return self.env.run("cloudhub_vpn", "bot", "3", *extra)

    def test_the_server_mints_no_key_when_given_a_public_key(self):
        result = self.add(NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertMintedNothing()

    def test_the_client_config_carries_no_private_key(self):
        self.add(NODE_PUBKEY)
        config = self.env.client_config("bot3", "wg_jaia_ch7")
        self.assertIsNotNone(config, "no client config was written")
        self.assertIn("PrivateKey = " + PLACEHOLDER, config)
        self.assertIn(SERVER_PUBKEY, config, "the client cannot reach a server it cannot name")

    def test_the_peer_is_stored_under_the_public_key_that_was_supplied(self):
        self.add(NODE_PUBKEY)
        fragment = self.env.peer_fragment("wg_cloudhub", "bot3")
        self.assertIsNotNone(fragment, "no peer was stored")
        self.assertIn("PublicKey = " + NODE_PUBKEY, fragment)
        self.assertNotIn(MINTED_PUBKEY, fragment)

    def test_the_instructions_stop_calling_the_config_secret(self):
        result = self.add(NODE_PUBKEY)
        self.assertNotIn("SECURELY", result.stdout,
                         "a config with no private key in it is not a secret to move")
        self.assertIn("holds no private key", result.stdout)

    def test_a_missing_public_key_is_refused(self):
        result = self.add()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("public key", result.stderr)
        self.assertIn("wg genkey", result.stderr, "the error does not say how to make one")
        self.assertIsNone(self.env.client_config("bot3", "wg_jaia_ch7"),
                          "a refused run still wrote a client config")
        self.assertIsNone(self.env.peer_fragment("wg_cloudhub", "bot3"),
                          "a refused run still added a peer")

    def test_a_malformed_public_key_is_refused(self):
        for bad in ("too-short", NODE_PUBKEY[:-1], NODE_PUBKEY + "A", "not a key!", ""):
            result = self.add(bad)
            self.assertNotEqual(result.returncode, 0,
                                "'{}' was accepted as a public key".format(bad))
            self.assertIsNone(self.env.peer_fragment("wg_cloudhub", "bot3"))


class VirtualFleetTest(GeneratorTest):
    def setUp(self):
        super().setUp()
        self.env.seed_server_config("wg_virtualfleet")

    def test_the_server_mints_no_key_when_given_a_public_key(self):
        result = self.env.run("vfleet_vpn", "hub", "1", NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertMintedNothing()
        self.assertIn("PublicKey = " + NODE_PUBKEY,
                      self.env.peer_fragment("wg_virtualfleet", "hub1"))

    def test_a_missing_public_key_is_refused(self):
        result = self.env.run("vfleet_vpn", "hub", "1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("public key", result.stderr)


class FleetVpnTest(GeneratorTest):
    """The one mode that may still omit a public key: it runs on vpn.jaia.tech,
    whose copy of this script does not come from this package."""

    def test_a_public_key_is_still_honoured(self):
        result = self.env.run("fleet_vpn", "bot", "3", "7", NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertMintedNothing()
        config = self.env.client_config("bot3", "wg_jaia_sf7")
        self.assertIn("PrivateKey = " + PLACEHOLDER, config)

    def test_omitting_it_still_works(self):
        result = self.env.run("fleet_vpn", "bot", "3", "7")
        self.assertEqual(result.returncode, 0, result.stderr)
        config = self.env.client_config("bot3", "wg_jaia_sf7")
        self.assertIn("PrivateKey = " + MINTED_PRIVKEY, config,
                      "the path the service VPN still depends on stopped working")

    def test_omitting_it_warns_that_the_server_made_the_key(self):
        result = self.env.run("fleet_vpn", "bot", "3", "7")
        self.assertIn("WARNING", result.stderr)
        self.assertIn("private key", result.stderr)

    def test_the_fleet_id_is_still_required(self):
        result = self.env.run("fleet_vpn", "bot", "3")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("fleet ID", result.stdout + result.stderr)


class ServerInitTest(GeneratorTest):
    def test_a_malformed_initial_public_key_is_refused(self):
        """Checked before anything is written, so this runs no further."""
        result = self.env.run("server_init", "7", "not-a-key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a WireGuard public key", result.stderr)
        self.assertEqual(self.env.recorded(), [],
                         "a refused server_init had already started configuring")

    def peers(self, interface):
        directory = os.path.join(self.env.wg_dir, interface + ".peers.d")
        return sorted(os.listdir(directory)) if os.path.isdir(directory) else []

    def test_with_no_initial_key_the_servers_come_up_with_no_peer(self):
        """Whoever builds a customer's CloudHub is not left a standing way into it."""
        result = self.env.run("server_init", "7")
        self.assertEqual(result.returncode, 0, result.stderr)
        for interface in ("wg_cloudhub", "wg_virtualfleet"):
            self.assertTrue(os.path.exists(os.path.join(self.env.wg_dir, interface + ".conf")))
            self.assertEqual(self.peers(interface), [])
            self.assertIn("systemctl enable wg-quick@" + interface, self.env.recorded())

    def test_an_initial_key_is_still_made_a_peer_of_both(self):
        result = self.env.run("server_init", "7", NODE_PUBKEY)
        self.assertEqual(result.returncode, 0, result.stderr)
        for interface in ("wg_cloudhub", "wg_virtualfleet"):
            self.assertEqual(self.peers(interface), ["desktop1.conf"])
            self.assertIn(NODE_PUBKEY, self.env.peer_fragment(interface, "desktop1"))


class UsageTest(GeneratorTest):
    def test_usage_names_the_public_key(self):
        result = self.env.run("cloudhub_vpn")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("client_pubkey", result.stdout)


if __name__ == "__main__":
    unittest.main()
