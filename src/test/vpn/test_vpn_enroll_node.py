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
SCRIPT = SOURCE_DIR / "src" / "sh" / "utils" / "jaia-pair-with-cloudhub.sh"
PLAYBOOK = SOURCE_DIR / "config" / "ansible" / "pair-fleet-to-cloudhub.yml"
PRESEED = (SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "jaiabot" /
           "init" / "first-boot.preseed.yml.j2")
INSTALL_LIST = SOURCE_DIR / "src" / "sh" / "CMakeLists.txt"

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

CLOUDHUB_VPN_IP = "fd0f:77ac:4fdf:7::1:1e"
OLD_CLOUDHUB_SSH_KEY = 'from="{}" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG9sZCBjbG91ZGh1YiBrZXk hub30_fleet7'.format(
    CLOUDHUB_VPN_IP)
NEW_CLOUDHUB_SSH_KEY = 'from="{}" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5ldyBjbG91ZGh1YiBrZXk hub30_fleet7'.format(
    CLOUDHUB_VPN_IP)
HUB1_SSH_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGh1YiAxIHlhYmlrZXkga2V5 hub1_fleet7"
ANSWER_WITH_KEY = CLOUDHUB_ANSWER + "# jaia-cloudhub-ssh-key: " + NEW_CLOUDHUB_SSH_KEY + "\n"

STUBS = {
    "sudo": 'exec "$@"\n',
    "mount": 'echo "mount $*" >> "$JAIA_TEST_CALLS"\n',
    "chown": 'echo "chown $*" >> "$JAIA_TEST_CALLS"\n',
    # Unreachable for the first $JAIA_TEST_NC_FAILURES probes, then reachable
    "nc": 'echo "nc $*" >> "$JAIA_TEST_CALLS"\n'
          'n=$(grep -c "^nc " "$JAIA_TEST_CALLS")\n'
          '[ "$n" -gt "${JAIA_TEST_NC_FAILURES:-0}" ]\n',
    "sleep": 'exit 0\n',
    # Status and timestamp queries are answered without being recorded, so "nothing
    # was done" stays an empty call log
    "systemctl": 'case "$1" in\n'
                 '    is-active) exit ${JAIA_TEST_ACTIVE:-0} ;;\n'
                 '    show) echo "${JAIA_TEST_STARTED:-}"; exit 0 ;;\n'
                 'esac\n'
                 'echo "systemctl $*" >> "$JAIA_TEST_CALLS"\n'
                 'case "$1" in is-enabled) exit ${JAIA_TEST_ENABLED:-0} ;; esac\n',
    "wg": """
case "$1" in
    genkey) echo "%(priv)s" ;;
    pubkey) cat > /dev/null; echo "%(pub)s" ;;
    show) echo "%(server)s	${JAIA_TEST_HANDSHAKE:-$(date +%%s)}" ;;
esac
""" % {"priv": NODE_PRIVKEY, "pub": NODE_PUBKEY, "server": SERVER_PUBKEY},
    "ssh": """
echo "ssh $*" >> "$JAIA_TEST_CALLS"
cat "$JAIA_TEST_ANSWER"
[ -n "${JAIA_TEST_SSH_STDERR:-}" ] && echo "$JAIA_TEST_SSH_STDERR" >&2
exit ${JAIA_TEST_SSH_STATUS:-0}
""",
    "ssh-keygen": 'echo "ssh-keygen $*" >> "$JAIA_TEST_CALLS"\n',
    # Writes the bootstrap key the way 'jaia admin fleet generate --action vpn_key' does
    "jaia": 'echo "jaia $*" >> "$JAIA_TEST_CALLS"\n'
            '[ -n "${JAIA_TEST_NO_STORED_KEY:-}" ] && exit 1\n'
            'while [ $# -gt 0 ]; do [ "$1" = --bootdir ] && dir=$2; shift; done\n'
            'echo "restored bootstrap key" > "$dir/jaiabot/init/id_vpn_tmp"\n',
}


class PackagingTest(unittest.TestCase):
    """A Minor Upgrade must be able to change pairing on nodes already in the field,
    so the script ships in a package rather than in the image."""

    def test_the_script_is_installed_by_a_package(self):
        self.assertIn("utils/jaia-pair-with-cloudhub.sh", INSTALL_LIST.read_text())

    def test_first_boot_runs_the_packaged_script(self):
        text = PRESEED.read_text()
        self.assertIn("/usr/bin/jaia-pair-with-cloudhub.sh", text)
        self.assertNotIn("/etc/jaiabot/init/pair-with-cloudhub.sh", text)

    def test_the_playbook_prefers_the_packaged_script_and_falls_back(self):
        text = PLAYBOOK.read_text()
        packaged = text.index("exec /usr/bin/jaia-pair-with-cloudhub.sh")
        self.assertLess(packaged, text.index("exec /etc/jaiabot/init/pair-with-cloudhub.sh"))
        self.assertIn("become: yes", text)


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

        self.fleet_cfg_dir = os.path.join(self.dir, "etc")
        os.makedirs(self.fleet_cfg_dir)
        self.stored_cfg = os.path.join(self.fleet_cfg_dir, "fleet7.cfg")
        with open(self.stored_cfg, "w") as f:
            f.write("version: 2\nfleet: 7\n")

        self.hub_keys = os.path.join(self.dir, "hub_authorized_keys")
        with open(self.hub_keys, "w") as f:
            f.write(HUB1_SSH_KEY + "\n" + OLD_CLOUDHUB_SSH_KEY + "\n")

        self.env = dict(
            os.environ,
            PATH=fake_bin + os.pathsep + os.environ["PATH"],
            JAIA_BOOT_DIR=self.boot,
            JAIA_SSH_DIR=self.ssh_dir,
            JAIA_WG_DIR=self.wg_dir,
            JAIA_DEBCONF_SH=debconf,
            JAIA_CLOUDHUB_HOST_FILE=os.path.join(self.dir, "cloudhub_host"),
            JAIA_FLEET_CFG_DIR=self.fleet_cfg_dir,
            JAIA_HUB_KEYS_FILE=self.hub_keys,
            JAIA_TEST_CALLS=self.calls,
            JAIA_TEST_ANSWER=self.answer,
        )

    def write_answer(self, text):
        with open(self.answer, "w") as f:
            f.write(text)

    def run_script(self, *host):
        """With no host at all, as "Pair Fleet to CloudHub" runs it; first boot always
        passes one, empty when the node is not to enroll."""
        return subprocess.run(["bash", str(SCRIPT)] + list(host or ("fleet7.jaia.tech",)),
                              capture_output=True, text=True, env=self.env)

    def run_again(self):
        return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True,
                              env=self.env)

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

    def hub_keys_lines(self):
        with open(self.hub_keys) as f:
            return f.read().splitlines()

    ## The CloudHub's SSH key, so its fleet actions reach the node

    def test_the_cloudhubs_ssh_key_replaces_the_one_the_node_was_imaged_with(self):
        self.write_answer(ANSWER_WITH_KEY)
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.hub_keys_lines(), [HUB1_SSH_KEY, NEW_CLOUDHUB_SSH_KEY])
        self.assertIn("Accepted fleet7.jaia.tech's SSH key", result.stdout)
        self.assertEqual(oct(os.stat(self.hub_keys).st_mode & 0o777), oct(0o644))

    def test_the_key_line_is_stripped_from_the_wireguard_config(self):
        self.write_answer(ANSWER_WITH_KEY)
        self.assertEqual(self.run_script().returncode, 0)
        self.assertEqual(self.installed_config(), CLOUDHUB_ANSWER.replace(PLACEHOLDER, NODE_PRIVKEY))

    def test_an_answer_without_a_key_changes_nothing(self):
        self.assertEqual(self.run_script().returncode, 0)
        self.assertEqual(self.hub_keys_lines(), [HUB1_SSH_KEY, OLD_CLOUDHUB_SSH_KEY])

    def test_a_key_already_trusted_is_left_alone(self):
        with open(self.hub_keys, "w") as f:
            f.write(HUB1_SSH_KEY + "\n" + NEW_CLOUDHUB_SSH_KEY + "\n")
        before = os.stat(self.hub_keys).st_mtime_ns
        self.write_answer(ANSWER_WITH_KEY)
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.stat(self.hub_keys).st_mtime_ns, before)
        self.assertNotIn("Accepted", result.stdout)

    def test_a_key_line_that_is_not_one_address_and_one_key_is_ignored(self):
        """The answer comes from whoever holds the CloudHub's name; what goes into
        authorized_keys is one restricted key, never options or a second key."""
        for line in ('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5vIGZyb20gcmVzdHJpY3Rpb24 hub30_fleet7',
                     'from="*" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGFueSBhZGRyZXNz hub30_fleet7',
                     'from="{}",command="rm -rf /" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGNvbW1hbmQ x'.format(
                         CLOUDHUB_VPN_IP),
                     'from="{}" ssh-ed25519 AAAA; cat /etc/shadow'.format(CLOUDHUB_VPN_IP)):
            with self.subTest(line=line):
                with open(self.hub_keys, "w") as f:
                    f.write(HUB1_SSH_KEY + "\n" + OLD_CLOUDHUB_SSH_KEY + "\n")
                self.write_answer(CLOUDHUB_ANSWER + "# jaia-cloudhub-ssh-key: " + line + "\n")
                if os.path.exists(self.wg_dir + "/wg_jaia_ch7.conf"):
                    os.remove(self.wg_dir + "/wg_jaia_ch7.conf")
                with open(self.bootstrap_key, "w") as f:
                    f.write("bootstrap\n")
                result = self.run_script()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("Ignoring the SSH key", result.stderr)
                self.assertEqual(self.hub_keys_lines(), [HUB1_SSH_KEY, OLD_CLOUDHUB_SSH_KEY])
                self.assertNotIn("jaia-cloudhub-ssh-key", self.installed_config())

    def test_pairing_again_after_a_rebuild_accepts_the_new_cloudhubs_key(self):
        self.assertEqual(self.run_script().returncode, 0)
        self.write_answer(ANSWER_WITH_KEY)
        self.env["JAIA_TEST_HANDSHAKE"] = "1000000000"
        result = self.run_again()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("pairing again", result.stdout)
        self.assertEqual(self.hub_keys_lines(), [HUB1_SSH_KEY, NEW_CLOUDHUB_SSH_KEY])

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


    ## Running again, which "Pair Fleet to CloudHub" does on every node

    def test_the_cloudhub_is_remembered_for_next_time(self):
        os.remove(self.bootstrap_key)
        self.run_script()
        with open(self.env["JAIA_CLOUDHUB_HOST_FILE"]) as f:
            self.assertEqual("fleet7.jaia.tech", f.read().strip())

    def test_a_node_that_missed_pairing_pairs_when_run_again_with_no_host(self):
        """First boot ran while the CloudHub was closed; the fleet-wide pairing later
        has no host to pass and must find the one first boot was given."""
        self.write_answer("Permission denied (publickey).\n")
        self.assertNotEqual(self.run_script().returncode, 0)

        self.write_answer(CLOUDHUB_ANSWER)
        result = self.run_again()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("jaia@fleet7.jaia.tech", self.recorded())
        self.assertIsNotNone(self.installed_config())

    def test_a_node_already_paired_is_left_exactly_as_it_is(self):
        """Safe to run across a whole fleet: nothing is asked of the CloudHub again, and
        a tunnel someone stopped on purpose stays stopped."""
        self.run_script()
        installed = self.installed_config()
        open(self.calls, "w").close()

        result = self.run_again()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Already paired", result.stdout)
        self.assertEqual("", self.recorded())
        self.assertEqual(installed, self.installed_config())

    def test_a_fresh_pairing_brings_the_tunnel_up_when_it_starts_at_boot(self):
        """First boot reboots afterwards; a pairing done later from a hub does not."""
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("systemctl restart wg-quick@wg_jaia_ch7", self.recorded())

    def test_a_hub_restarts_its_portal_once_the_tunnel_is_up(self):
        """HUB2HUB binds only if the tunnel exists when the portal starts, and a hub
        paired after boot (as every node is after a major upgrade) started it without."""
        with open(self.env["JAIA_DEBCONF_SH"], "w") as f:
            f.write("jaia_debconf_get() { case $1 in type) echo hub ;; fleet_id) echo 7 ;; esac; }\n"
                    "jaia_debconf_node_id() { echo 3; }\n")
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.recorded()
        self.assertIn("systemctl restart jaiabot_goby_intervehicle_portal", calls)
        self.assertLess(calls.index("restart wg-quick@wg_jaia_ch7"),
                        calls.index("restart jaiabot_goby_intervehicle_portal"))

    def test_a_bot_leaves_its_portal_running(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("jaiabot_goby_intervehicle_portal", self.recorded())

    def test_a_fresh_pairing_leaves_a_tunnel_not_set_to_start_at_boot_stopped(self):
        """Whether it comes up by itself is the fleet config's choice, not pairing's."""
        self.env["JAIA_TEST_ENABLED"] = "1"
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("restart", self.recorded())
        self.assertIn("left stopped", result.stdout)
        self.assertIsNotNone(self.installed_config())

    def test_pairing_never_changes_whether_the_tunnel_starts_at_boot(self):
        self.run_script()
        self.run_again()
        self.assertNotRegex(self.recorded(), r"systemctl (enable|disable)")

    def test_the_key_is_spent_before_the_tunnel_is_started(self):
        """So a tunnel that will not start is retried on its own, not by enrolling
        a second time with a key that has already done its job."""
        stub = os.path.join(self.dir, "bin", "systemctl")
        with open(stub, "w") as f:
            f.write('#!/bin/sh\necho "systemctl $*" >> "$JAIA_TEST_CALLS"\n'
                    'case "$1" in restart) exit 1 ;; esac\n')
        with open(stub, "a") as f:
            f.write('case "$1" in is-enabled) exit 0 ;; esac\n')
        self.assertNotEqual(self.run_script().returncode, 0)
        self.assertFalse(os.path.exists(self.moved_key))
        self.assertFalse(os.path.exists(self.bootstrap_key))
        self.assertIn("Already paired", self.run_again().stdout)

    def test_an_explicitly_empty_host_still_means_do_not_enroll(self):
        """What first boot passes for the CloudHub itself, and for a fleet that should
        not enroll - a remembered host from earlier must not override it."""
        with open(self.env["JAIA_CLOUDHUB_HOST_FILE"], "w") as f:
            f.write("fleet7.jaia.tech\n")
        result = self.run_script("")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded(), "")

    def test_with_no_host_and_none_remembered_nothing_happens(self):
        result = self.run_again()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded(), "")

    ## Reaching the CloudHub

    def test_the_cloudhub_is_reached_over_tcp_not_ping(self):
        """Some ship, satellite and corporate networks pass TCP but block ICMP"""
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("nc -z -w 5 fleet7.jaia.tech 443", self.recorded())
        self.assertNotIn("ping", self.recorded())

    def test_a_network_that_comes_up_late_is_waited_for(self):
        self.env["JAIA_TEST_NC_FAILURES"] = "3"
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded().count("nc -z"), 4)
        self.assertIsNotNone(self.installed_config())

    def test_an_unreachable_cloudhub_leaves_the_key_and_says_so(self):
        self.env["JAIA_TEST_NC_FAILURES"] = "1000"
        self.env["JAIA_PAIRING_WAIT_SECONDS"] = "0"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Could not reach fleet7.jaia.tech (TCP port 443)", result.stderr)
        self.assertNotIn("ssh ", self.recorded())
        self.assertTrue(os.path.exists(self.bootstrap_key), "the bootstrap key was moved off the boot partition")

    def test_a_refusal_points_at_fleet_pairing(self):
        """Reachable on 443 but turned away on 22: pairing is closed, not the network down"""
        self.env["JAIA_TEST_SSH_STATUS"] = "255"
        self.write_answer("")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("is fleet pairing open", result.stderr)
        self.assertTrue(os.path.exists(self.moved_key))

    def test_the_attempt_is_bounded(self):
        """A CloudHub not open for pairing drops the connection, which would otherwise
        hold up first boot for as long as TCP is willing to wait."""
        self.run_script()
        self.assertIn("ConnectTimeout=", self.recorded())

    def test_a_changed_host_key_is_reported_as_such(self):
        """Not "is fleet pairing open": the operator would open it and see the same."""
        self.env["JAIA_TEST_SSH_STATUS"] = "255"
        self.env["JAIA_TEST_SSH_STDERR"] = "Host key verification failed."
        self.write_answer("")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SSH host key is not the one this node recorded", result.stderr)
        self.assertNotIn("is fleet pairing open", result.stderr)
        self.assertIn("ssh: Host key verification failed.", result.stderr)

    def test_a_first_pairing_keeps_the_host_key_it_already_trusts(self):
        self.assertEqual(self.run_script().returncode, 0)
        self.assertNotIn("ssh-keygen", self.recorded())

    ## A CloudHub replaced under the same name

    def paired_then_replaced(self, **env):
        """Paired once, the key spent, and the CloudHub then rebuilt: the tunnel stops
        handshaking while the name still answers on 443."""
        self.assertEqual(self.run_script().returncode, 0)
        open(self.calls, "w").close()
        self.env.update(env)
        return self.run_again()

    def stale(self):
        return {"JAIA_TEST_HANDSHAKE": "1000000000"}

    def test_a_tunnel_that_stopped_handshaking_pairs_again(self):
        result = self.paired_then_replaced(**self.stale())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("pairing again", result.stdout)
        self.assertIn("Paired with fleet7.jaia.tech", result.stdout)
        self.assertIn("jaia@fleet7.jaia.tech bot 3 " + NODE_PUBKEY, self.recorded())

    def test_pairing_again_takes_the_key_from_the_nodes_own_fleet_config(self):
        self.paired_then_replaced(**self.stale())
        self.assertIn("jaia admin fleet generate {} bot 3 --action vpn_key".format(self.stored_cfg),
                      self.recorded())
        self.assertFalse(os.path.exists(self.moved_key), "the restored key was not spent")

    def test_pairing_again_accepts_the_replacement_host_key(self):
        self.paired_then_replaced(**self.stale())
        calls = self.recorded()
        self.assertIn("ssh-keygen -R fleet7.jaia.tech", calls)
        self.assertLess(calls.index("ssh-keygen -R"), calls.index("ssh -o"))

    def test_pairing_again_keeps_the_nodes_wireguard_identity(self):
        for name, value in (("privatekey", "a" * 43 + "="), ("publickey", "b" * 43 + "=")):
            with open(os.path.join(self.wg_dir, name), "w") as f:
                f.write(value + "\n")
        self.paired_then_replaced(**self.stale())
        self.assertIn("bot 3 " + "b" * 43 + "=", self.recorded())
        self.assertIn("PrivateKey = " + "a" * 43 + "=", self.installed_config())

    def test_a_live_tunnel_is_not_paired_again(self):
        result = self.paired_then_replaced()
        self.assertIn("Already paired", result.stdout)
        self.assertEqual("", self.recorded())

    def test_a_stopped_tunnel_is_not_taken_for_a_replaced_cloudhub(self):
        result = self.paired_then_replaced(JAIA_TEST_ACTIVE="3", **self.stale())
        self.assertIn("Already paired", result.stdout)
        self.assertEqual("", self.recorded())

    def test_a_tunnel_that_has_not_handshaken_yet_is_given_time(self):
        result = self.paired_then_replaced(JAIA_TEST_HANDSHAKE="0",
                                           JAIA_TEST_STARTED=subprocess.check_output(
                                               ["date"], text=True).strip())
        self.assertIn("Already paired", result.stdout)

    def test_a_tunnel_that_never_handshook_since_long_ago_pairs_again(self):
        result = self.paired_then_replaced(JAIA_TEST_HANDSHAKE="0",
                                           JAIA_TEST_STARTED="Mon 2026-01-05 00:00:00 UTC")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("pairing again", result.stdout)

    def test_an_unreachable_cloudhub_is_not_mistaken_for_a_replaced_one(self):
        self.assertEqual(self.run_script().returncode, 0)
        open(self.calls, "w").close()
        self.env.update(self.stale(), JAIA_TEST_NC_FAILURES="1000", JAIA_PAIRING_WAIT_SECONDS="0")
        result = self.run_again()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Could not reach fleet7.jaia.tech", result.stderr)
        self.assertNotIn("jaia admin", self.recorded())
        self.assertFalse(os.path.exists(self.moved_key))

    def test_without_a_stored_fleet_config_it_says_how_to_pair_again(self):
        os.remove(self.stored_cfg)
        result = self.paired_then_replaced(**self.stale())
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no {} to take the fleet's bootstrap key from".format(self.stored_cfg), result.stderr)
        self.assertNotIn("ssh ", self.recorded())

    def test_a_key_that_cannot_be_taken_from_the_config_stops_the_attempt(self):
        result = self.paired_then_replaced(JAIA_TEST_NO_STORED_KEY="1", **self.stale())
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not take the bootstrap key", result.stderr)
        self.assertNotIn("ssh ", self.recorded())

    def test_a_refused_repairing_leaves_the_restored_key_for_another_try(self):
        """As on first boot: refused because pairing was closed, so run it again once open"""
        self.assertEqual(self.run_script().returncode, 0)
        open(self.calls, "w").close()
        self.env.update(self.stale(), JAIA_TEST_SSH_STATUS="255")
        self.write_answer("")
        self.assertNotEqual(self.run_again().returncode, 0)
        self.assertTrue(os.path.exists(self.moved_key))
        with open(self.moved_key) as f:
            self.assertIn("restored", f.read())


if __name__ == "__main__":
    unittest.main()
