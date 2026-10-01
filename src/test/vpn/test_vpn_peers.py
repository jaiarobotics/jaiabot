#!/usr/bin/env python3

"""Adding a peer must not restart the interface it is added to.

The CloudHub VPN carries HUB2HUB (config/gen/common/comms.py asks for a
cloudhub_vpn address, and config/gen/hub.py enables the link because that
interface exists), so bouncing wg_cloudhub takes the fleet's inter-hub link
down and every support session with it. Once a node enrols itself at first
boot that stops being a rare supervised act, which is what these tests pin:
a peer reaches a running interface through 'wg syncconf' - documented as
applying only the differences - and nothing in the path restarts anything.

wg(8) and a WireGuard interface are not available to the build, so wg,
wg-quick and systemctl are stubs that record what they were asked to do.
"""

import os
import pathlib
import shutil
import stat
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-peers.sh"
GENERATOR = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-vpn-gen.sh"

INTERFACE = "wg_cloudhub"

KEY_CLIENT = "yZ0oFZ1mYOkCL7OeGBZ0z6mXgQZ0nMhHPZ1kWJ6kSng="
KEY_HUB1 = "mE7v1qCg0eQ0v8rJ5kKX1Z6pQ2fT3uY4wA5sD6fG7hI="
KEY_BOT3 = "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4c="
KEY_NEW = "Zz9yY8xX7wW6vV5uU4tT3sS2rR1qQ0pP9oO8nN7mM6l="

# The shape a CloudHub created before the peers directory is left holding: the
# config server_init wrote, with peers appended to it by the generator.
FLAT_CONFIG = """##########################
#### CloudHub VPN #########
###########################

[Interface]

# VPN Address for server
Address = fd0f:77ac:4fdf:7::1e/64

# VPN Server Port
ListenPort = 51821

# PrivateKey (contents of /etc/wireguard/privatekey)
PrivateKey = qJ8KZ1cMOBuEMBXmcL5pcOT8MQQ6YtGxYlfxrTPLKmc=

PostUp = iptables -w 60 -A FORWARD -i wg_cloudhub -j ACCEPT
PostDown = iptables -w 60 -D FORWARD -i wg_cloudhub -j ACCEPT

[Peer]
# Initial Setup Client
PublicKey = {client}
AllowedIPs = fd0f:77ac:4fdf:7::d01/128
# BEGIN PEER hub 1: CONFIGURED BY vpn_gen.sh
[Peer]
PublicKey = {hub1}
AllowedIPs = fd0f:77ac:4fdf:7::101/128
# END PEER hub 1: CONFIGURED BY vpn_gen.sh
# BEGIN PEER bot 3: CONFIGURED BY vpn_gen.sh
[Peer]
PublicKey = {bot3}
AllowedIPs = fd0f:77ac:4fdf:7::203/128
# END PEER bot 3: CONFIGURED BY vpn_gen.sh
""".format(client=KEY_CLIENT, hub1=KEY_HUB1, bot3=KEY_BOT3)

INTERFACE_ONLY_CONFIG = """[Interface]
Address = fd0f:77ac:4fdf:7::1e/64
ListenPort = 51821
PrivateKey = qJ8KZ1cMOBuEMBXmcL5pcOT8MQQ6YtGxYlfxrTPLKmc=
PostUp = iptables -w 60 -A FORWARD -i wg_cloudhub -j ACCEPT
PostUp = jaia-vpn-peers.sh apply %i
PostDown = iptables -w 60 -D FORWARD -i wg_cloudhub -j ACCEPT
"""

# "strip" drops the keys wg-quick handles itself and keeps everything wg reads.
STUBS = {
    "wg": """
echo "wg $*" >> "$JAIA_TEST_CALLS"
case "$1" in
    show) [ -e "$JAIA_TEST_UP" ] || exit 1 ;;
    syncconf) cp "$3" "$JAIA_TEST_RUNNING" ;;
esac
exit 0
""",
    "wg-quick": """
echo "wg-quick $*" >> "$JAIA_TEST_CALLS"
case "$1" in
    strip) grep -v -E '^[[:space:]]*(Address|MTU|DNS|Table|PreUp|PostUp|PreDown|PostDown|SaveConfig)[[:space:]]*=' "$2" ;;
    *) exit 1 ;;
esac
exit 0
""",
    "systemctl": """
echo "systemctl $*" >> "$JAIA_TEST_CALLS"
exit 0
""",
}


class Env:
    """A scratch /etc/wireguard with stubbed wg, wg-quick and systemctl."""

    def __init__(self, up=True):
        self.dir = tempfile.mkdtemp()
        self.wg_dir = os.path.join(self.dir, "wireguard")
        os.makedirs(self.wg_dir, mode=0o700)

        self.calls = os.path.join(self.dir, "calls")
        self.running = os.path.join(self.dir, "running.conf")
        self.up_marker = os.path.join(self.dir, "up")
        if up:
            open(self.up_marker, "w").close()

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
            JAIA_WG_DIR=self.wg_dir,
            JAIA_TEST_CALLS=self.calls,
            JAIA_TEST_RUNNING=self.running,
            JAIA_TEST_UP=self.up_marker,
        )

    def run(self, *args):
        return subprocess.run(
            ["bash", str(SCRIPT)] + list(args),
            capture_output=True, text=True, env=self.env)

    def write_config(self, text, interface=INTERFACE):
        path = os.path.join(self.wg_dir, interface + ".conf")
        with open(path, "w") as f:
            f.write(text)
        os.chmod(path, 0o600)
        return path

    def config(self, interface=INTERFACE):
        with open(os.path.join(self.wg_dir, interface + ".conf")) as f:
            return f.read()

    def peers_dir(self, interface=INTERFACE):
        return os.path.join(self.wg_dir, interface + ".peers.d")

    def peer_files(self, interface=INTERFACE):
        directory = self.peers_dir(interface)
        if not os.path.isdir(directory):
            return []
        return sorted(f for f in os.listdir(directory) if f.endswith(".conf"))

    def peer(self, name, interface=INTERFACE):
        with open(os.path.join(self.peers_dir(interface), name + ".conf")) as f:
            return f.read()

    def applied(self):
        """What the interface was last told to run."""
        if not os.path.exists(self.running):
            return ""
        with open(self.running) as f:
            return f.read()

    def recorded(self):
        if not os.path.exists(self.calls):
            return []
        with open(self.calls) as f:
            return [line.strip() for line in f if line.strip()]

    def cleanup(self):
        shutil.rmtree(self.dir, ignore_errors=True)


class PeersTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.env.write_config(INTERFACE_ONLY_CONFIG)
        self.addCleanup(self.env.cleanup)

    def assertNothingRestarted(self):
        for call in self.env.recorded():
            self.assertFalse(
                call.startswith("systemctl"),
                "a peer change invoked '{}'; restarting the interface drops "
                "HUB2HUB and every live session".format(call))
            self.assertNotIn(
                " setconf ", " " + call + " ",
                "a peer change used 'wg setconf', which resets peers that "
                "did not change; 'wg syncconf' applies only the differences")
            for verb in ("up", "down"):
                self.assertNotEqual(
                    call, "wg-quick {} {}".format(verb, INTERFACE),
                    "a peer change brought the interface {}".format(verb))


class AddTest(PeersTest):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.env.run("add", INTERFACE, "desktop1", KEY_CLIENT,
                                      "fd0f:77ac:4fdf:7::d01/128").returncode, 0)

    def test_adding_a_peer_does_not_restart_the_interface(self):
        self.env.run("add", INTERFACE, "bot3", KEY_BOT3, "fd0f:77ac:4fdf:7::203/128")
        self.assertNothingRestarted()
        self.assertIn("wg syncconf " + INTERFACE,
                      " ".join(self.env.recorded()),
                      "the peer never reached the running interface")

    def test_an_added_peer_reaches_the_running_interface(self):
        result = self.env.run("add", INTERFACE, "bot3", KEY_BOT3,
                              "fd0f:77ac:4fdf:7::203/128")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(KEY_BOT3, self.env.applied())
        self.assertIn("fd0f:77ac:4fdf:7::203/128", self.env.applied())

    def test_an_add_leaves_the_existing_peers_in_place(self):
        self.env.run("add", INTERFACE, "bot3", KEY_BOT3, "fd0f:77ac:4fdf:7::203/128")
        self.assertIn(KEY_CLIENT, self.env.applied(),
                      "enrolling a bot dropped the peer that was already there")

    def test_the_applied_config_keeps_the_interface_settings(self):
        self.env.run("add", INTERFACE, "bot3", KEY_BOT3, "fd0f:77ac:4fdf:7::203/128")
        applied = self.env.applied()
        self.assertIn("PrivateKey = ", applied)
        self.assertIn("ListenPort = 51821", applied)

    def test_a_duplicate_peer_is_refused(self):
        result = self.env.run("add", INTERFACE, "desktop1", KEY_NEW,
                              "fd0f:77ac:4fdf:7::d01/128")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already a peer", result.stderr)
        self.assertNotIn(KEY_NEW, self.env.peer("desktop1"),
                         "a refused add overwrote the peer it collided with")

    def test_a_peer_name_may_not_escape_the_directory(self):
        for name in ("../evil", "a/b", "a b", "", "."):
            result = self.env.run("add", INTERFACE, name, KEY_NEW, "10.0.0.1/32")
            self.assertNotEqual(result.returncode, 0,
                                "'{}' was accepted as a peer name".format(name))
        self.assertEqual(self.env.peer_files(), ["desktop1.conf"])

    def test_applying_does_not_write_the_config_it_hands_to_wg(self):
        """apply runs from the interface's PostUp. Staging the config on disk makes
        bringing the interface up depend on a writable filesystem, and wg-quick
        deletes the interface when a PostUp hook fails."""
        self.assertEqual(self.env.run("apply", INTERFACE).returncode, 0)
        synced = [c for c in self.env.recorded() if c.startswith("wg syncconf ")]
        self.assertTrue(synced, "apply never reached wg syncconf")
        for call in synced:
            path = call.split()[-1]
            self.assertFalse(
                path.startswith(self.env.wg_dir),
                "apply staged {} inside the wireguard directory; on a read-only "
                "root that write fails and takes the interface with it".format(path))

    def test_a_peer_added_while_the_interface_is_down_is_applied_when_it_comes_up(self):
        down = Env(up=False)
        self.addCleanup(down.cleanup)
        down.write_config(INTERFACE_ONLY_CONFIG)

        result = down.run("add", INTERFACE, "bot3", KEY_BOT3, "fd0f:77ac:4fdf:7::203/128")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(down.applied(), "", "syncconf ran against a down interface")
        self.assertIn(KEY_BOT3, down.peer("bot3"))

        open(down.up_marker, "w").close()
        self.assertEqual(down.run("apply", INTERFACE).returncode, 0)
        self.assertIn(KEY_BOT3, down.applied(),
                      "the boot hook did not load the peers directory")


class RemoveTest(PeersTest):
    def setUp(self):
        super().setUp()
        self.env.run("add", INTERFACE, "desktop1", KEY_CLIENT, "fd0f:77ac:4fdf:7::d01/128")
        self.env.run("add", INTERFACE, "bot3", KEY_BOT3, "fd0f:77ac:4fdf:7::203/128")

    def test_removing_a_peer_takes_it_off_the_running_interface(self):
        result = self.env.run("remove", INTERFACE, "bot3")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(KEY_BOT3, self.env.applied())
        self.assertIn(KEY_CLIENT, self.env.applied(),
                      "revoking one peer took another with it")

    def test_removing_a_peer_does_not_restart_the_interface(self):
        self.env.run("remove", INTERFACE, "bot3")
        self.assertNothingRestarted()

    def test_removing_an_unknown_peer_is_an_error(self):
        result = self.env.run("remove", INTERFACE, "bot9")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a peer", result.stderr)

    def test_list_names_the_peers(self):
        result = self.env.run("list", INTERFACE)
        self.assertEqual(sorted(result.stdout.split()), ["bot3", "desktop1"])


class MigrateTest(PeersTest):
    def setUp(self):
        super().setUp()
        self.env.write_config(FLAT_CONFIG)
        result = self.env.run("migrate", INTERFACE)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_migrate_moves_every_peer_into_the_directory(self):
        self.assertNotIn("[Peer]", self.env.config(),
                         "a peer was left behind in the flat config")
        for key in (KEY_CLIENT, KEY_HUB1, KEY_BOT3):
            self.assertIn(
                key,
                "".join(self.env.peer(f[: -len(".conf")]) for f in self.env.peer_files()),
                "migrating lost the peer holding {}".format(key))

    def test_migrate_names_a_marked_peer_after_its_node(self):
        self.assertEqual(self.env.peer_files(),
                         ["bot3.conf", "hub1.conf", "peer-1.conf"])
        self.assertIn(KEY_HUB1, self.env.peer("hub1"))
        self.assertIn(KEY_BOT3, self.env.peer("bot3"))
        self.assertIn(KEY_CLIENT, self.env.peer("peer-1"))

    def test_migrate_keeps_the_marker_comments_out_of_the_fragments(self):
        self.assertNotIn("BEGIN PEER", self.env.peer("hub1"))
        self.assertNotIn("END PEER", self.env.peer("hub1"))
        self.assertTrue(self.env.peer("hub1").startswith("[Peer]"))

    def test_migrate_keeps_the_interface_settings(self):
        config = self.env.config()
        for line in ("Address = fd0f:77ac:4fdf:7::1e/64",
                     "ListenPort = 51821",
                     "PrivateKey = qJ8KZ1cMOBuEMBXmcL5pcOT8MQQ6YtGxYlfxrTPLKmc=",
                     "PostUp = iptables -w 60 -A FORWARD -i wg_cloudhub -j ACCEPT",
                     "PostDown = iptables -w 60 -D FORWARD -i wg_cloudhub -j ACCEPT"):
            self.assertIn(line, config)

    def test_migrate_adds_the_boot_hook(self):
        self.assertIn("PostUp = jaia-vpn-peers.sh apply %i", self.env.config())

    def test_migrate_is_idempotent(self):
        before = (self.env.config(), self.env.peer_files())
        self.assertEqual(self.env.run("migrate", INTERFACE).returncode, 0)
        self.assertEqual((self.env.config(), self.env.peer_files()), before)
        self.assertEqual(self.env.config().count("jaia-vpn-peers.sh apply"), 1)

    def test_migrate_does_not_touch_the_interface(self):
        self.assertNothingRestarted()
        self.assertEqual(self.env.applied(), "",
                         "migrating applied a config; the restart that follows it does that")

    def test_a_migrated_interface_serves_every_peer_at_boot(self):
        self.assertEqual(self.env.run("apply", INTERFACE).returncode, 0)
        for key in (KEY_CLIENT, KEY_HUB1, KEY_BOT3):
            self.assertIn(key, self.env.applied())

    def test_migrate_refuses_an_interface_with_no_config(self):
        result = self.env.run("migrate", "wg_nope")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("to migrate", result.stderr)


class MigrateUnparsedPeerTest(PeersTest):
    """A section header the splitter does not recognise keeps its peer where it
    is, which puts the boot hook's placement under the same rule."""

    ODD_CONFIG = """[Interface]
Address = fd0f:77ac:4fdf:7::1e/64
ListenPort = 51821
PrivateKey = qJ8KZ1cMOBuEMBXmcL5pcOT8MQQ6YtGxYlfxrTPLKmc=

[Peer] # left as it was
PublicKey = {hub1}
AllowedIPs = fd0f:77ac:4fdf:7::101/128
""".format(hub1=KEY_HUB1)

    def setUp(self):
        super().setUp()
        self.env.write_config(self.ODD_CONFIG)
        self.assertEqual(self.env.run("migrate", INTERFACE).returncode, 0)

    def test_the_peer_is_not_lost(self):
        self.assertIn(KEY_HUB1, self.env.config())
        self.assertEqual(self.env.peer_files(), [])

    def test_the_boot_hook_lands_in_the_interface_section(self):
        config = self.env.config()
        hook = config.index("PostUp = jaia-vpn-peers.sh apply %i")
        self.assertLess(
            hook, config.index("[Peer]"),
            "the boot hook was written below a section header, which makes it "
            "a key of that section rather than of [Interface]")

    def test_migrate_refuses_a_config_with_no_interface_section(self):
        self.env.write_config("[Peer] # left as it was\nPublicKey = {}\n".format(KEY_HUB1))
        result = self.env.run("migrate", INTERFACE)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("[Interface]", result.stderr)


class SourceTest(unittest.TestCase):
    """Neither script is compiled or linted anywhere else."""

    def test_the_vpn_scripts_parse(self):
        for script in (SCRIPT, GENERATOR):
            result = subprocess.run(["bash", "-n", str(script)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0,
                             "{}: {}".format(script.name, result.stderr))

    def test_the_peers_script_is_executable(self):
        self.assertTrue(os.stat(SCRIPT).st_mode & stat.S_IXUSR,
                        "{} is installed with install(PROGRAMS)".format(SCRIPT.name))


if __name__ == "__main__":
    unittest.main()
