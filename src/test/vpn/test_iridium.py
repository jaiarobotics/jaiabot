#!/usr/bin/env python3

"""iridium.jaia.tech relays every fleet's Iridium messages over that fleet's CloudHub
VPN, as hub 25. It serves release 2 and release 3 fleets side by side, whose CloudHub
VPNs number hubs differently, and joins a release 3 fleet by enrolling with the
fleet's bootstrap key while Fleet Pairing is open."""

import os
import stat
import subprocess
import tempfile
import unittest

from test_vpn_gen import SOURCE_DIR

TUNNEL = SOURCE_DIR / "src" / "sh" / "system" / "jaia-iridium-tunnel.sh"
ENROLL = SOURCE_DIR / "src" / "sh" / "system" / "jaia-iridium-enroll.sh"
STAGE = SOURCE_DIR / "rootfs" / "cloud" / "aws" / "iridium" / "stage_migration.sh"

SECRET_KEY = "SXJpZGl1bSBzZXJ2ZXIgcHJpdmF0ZSBrZXkgZm9yIDc="
PUBLIC_KEY = "SXJpZGl1bSBzZXJ2ZXIgcHVibGljIGtleSBmb3IgNyE="
PLACEHOLDER = "REPLACE_WITH_THE_CONTENTS_OF_/etc/wireguard/privatekey"

ANSWER = """[Interface]
# from /etc/wireguard/privatekey on client
PrivateKey = {placeholder}

# this client's VPN IP address
Address = fd0f:77ac:4fdf:8::1:19/128

[Peer]
PublicKey = Q2xvdWRIdWIgcHVibGljIGtleSBmb3IgZmxlZXQgOCE=
AllowedIPs = fd0f:77ac:4fdf:8::/64
Endpoint = 203.0.113.8:51821
PersistentKeepalive = 52
""".format(placeholder=PLACEHOLDER)


class Sandbox:
    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.bin = os.path.join(self.dir, "bin")
        self.wg_dir = os.path.join(self.dir, "wireguard")
        os.makedirs(self.bin)
        os.makedirs(self.wg_dir)
        self.calls = os.path.join(self.dir, "calls")
        open(self.calls, "w").close()
        self.stub("jaia_bounds", 'case "$1" in --cloudhub_id) echo 30 ;; --iridium_id) echo 25 ;; esac')
        self.env = dict(os.environ, PATH=self.bin + ":" + os.environ["PATH"], JAIA_WG_DIR=self.wg_dir,
                        JAIA_TEST_CALLS=self.calls)

    def stub(self, name, body):
        path = os.path.join(self.bin, name)
        with open(path, "w") as f:
            f.write("#!/bin/bash\n" + body + "\n")
        os.chmod(path, 0o755)

    def recorded(self):
        with open(self.calls) as f:
            return f.read()

    def cleanup(self):
        self.tmp.cleanup()


class TunnelTest(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox()
        self.addCleanup(self.box.cleanup)
        self.box.stub("socat", 'echo "socat $*" >> "$JAIA_TEST_CALLS"')

    def tunnel(self, fleet, address):
        with open(os.path.join(self.box.wg_dir, "wg_jaia_ch{}.conf".format(fleet)), "w") as f:
            f.write("[Interface]\nPrivateKey = x\nAddress = {}/128\n".format(address))
        return subprocess.run(["bash", str(TUNNEL), str(fleet)], capture_output=True, text=True,
                              env=self.box.env, timeout=10)

    def test_a_release_3_fleet_reaches_its_cloudhub_at_1_1e(self):
        result = self.tunnel(8, "fd0f:77ac:4fdf:8::1:19")
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.box.recorded()
        self.assertIn("TCP-LISTEN:11808,reuseaddr,fork TCP:[fd0f:77ac:4fdf:8::1:1e]:11800", calls)
        self.assertIn("TCP-LISTEN:12808,reuseaddr,fork TCP:[fd0f:77ac:4fdf:8::1:1e]:12800", calls)
        self.assertIn("TCP-LISTEN:10808,reuseaddr,fork TCP:directip.sbd.iridium.com:10800", calls)

    def test_a_release_2_fleet_reaches_its_cloudhub_at_1e(self):
        result = self.tunnel(36, "fd0f:77ac:4fdf:24::19")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("TCP:[fd0f:77ac:4fdf:24::1e]:11800", self.box.recorded())

    def test_it_can_report_the_cloudhub_address_without_starting_anything(self):
        with open(os.path.join(self.box.wg_dir, "wg_jaia_ch8.conf"), "w") as f:
            f.write("[Interface]\nAddress = fd0f:77ac:4fdf:8::1:19/128\n")
        result = subprocess.run(["bash", str(TUNNEL), "8", "--cloudhub-address"], capture_output=True,
                                text=True, env=self.box.env, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "fd0f:77ac:4fdf:8::1:1e\n")
        self.assertEqual(self.box.recorded(), "")

    def test_a_tunnel_that_is_not_hub_25_starts_nothing(self):
        result = self.tunnel(8, "fd0f:77ac:4fdf:8::1:1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.box.recorded(), "")


class EnrollTest(unittest.TestCase):
    def setUp(self):
        self.box = Sandbox()
        self.addCleanup(self.box.cleanup)
        self.box.stub("wg", """echo "wg $*" >> "$JAIA_TEST_CALLS"
case "$1" in
    genkey) echo "{secret}" ;;
    pubkey) read key; [ "$key" = "{secret}" ] && echo "{public}" ;;
esac""".format(secret=SECRET_KEY, public=PUBLIC_KEY))
        self.box.stub("systemctl", 'echo "systemctl $*" >> "$JAIA_TEST_CALLS"')
        self.box.stub("ssh-keygen", 'echo "ssh-keygen $*" >> "$JAIA_TEST_CALLS"')
        self.answer = os.path.join(self.box.dir, "answer")
        with open(self.answer, "w") as f:
            f.write(ANSWER)
        self.box.stub("ssh", 'echo "ssh $*" >> "$JAIA_TEST_CALLS"\ncat "{}"'.format(self.answer))
        self.bootstrap = os.path.join(self.box.dir, "id_vpn_tmp")
        with open(self.bootstrap, "w") as f:
            f.write("bootstrap key\n")
        self.conf = os.path.join(self.box.wg_dir, "wg_jaia_ch8.conf")

    def enroll(self, *args):
        args = args or ("8", "fleet8.example.org", self.bootstrap)
        return subprocess.run(["bash", str(ENROLL)] + list(args), capture_output=True, text=True,
                              env=self.box.env)

    def test_enrolls_over_the_pairing_port_as_iridium(self):
        result = self.enroll()
        self.assertEqual(result.returncode, 0, result.stderr)
        ssh = [line for line in self.box.recorded().splitlines() if line.startswith("ssh ")][0]
        self.assertIn("-p 2222", ssh)
        self.assertTrue(ssh.endswith("jaia@fleet8.example.org iridium " + PUBLIC_KEY), ssh)

    def test_the_config_carries_its_own_key_and_only_root_can_read_it(self):
        self.assertEqual(self.enroll().returncode, 0)
        with open(self.conf) as f:
            conf = f.read()
        self.assertIn("PrivateKey = " + SECRET_KEY + "\n", conf)
        self.assertNotIn(PLACEHOLDER, conf)
        self.assertIn("Address = fd0f:77ac:4fdf:8::1:19/128", conf)
        self.assertEqual(stat.S_IMODE(os.stat(self.conf).st_mode), 0o600)
        key = os.path.join(self.box.wg_dir, "wg_jaia_ch8.key")
        self.assertEqual(stat.S_IMODE(os.stat(key).st_mode), 0o600)

    def test_the_private_key_is_never_on_a_command_line(self):
        self.assertEqual(self.enroll().returncode, 0)
        self.assertNotIn(SECRET_KEY, self.box.recorded())

    def test_the_tunnel_and_the_relay_are_started_for_the_fleet(self):
        self.assertEqual(self.enroll().returncode, 0)
        calls = self.box.recorded()
        for unit in ("wg-quick@wg_jaia_ch8", "jaiabot__iridium_fleet@8"):
            self.assertIn("systemctl enable " + unit, calls)
            self.assertIn("systemctl restart " + unit, calls)

    def test_enrolling_again_keeps_the_fleets_key(self):
        self.assertEqual(self.enroll().returncode, 0)
        self.assertEqual(self.enroll().returncode, 0)
        self.assertEqual(self.box.recorded().count("wg genkey"), 1)

    def test_a_refusal_installs_nothing(self):
        self.box.stub("ssh", 'echo "Permission denied (publickey)." >&2\nexit 255')
        result = self.enroll()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Fleet Pairing", result.stderr)
        self.assertFalse(os.path.exists(self.conf))
        self.assertNotIn("systemctl", self.box.recorded())

    def test_an_answer_that_is_not_a_config_installs_nothing(self):
        with open(self.answer, "w") as f:
            f.write("ERROR: expected something else\n")
        self.assertNotEqual(self.enroll().returncode, 0)
        self.assertFalse(os.path.exists(self.conf))

    def test_the_fleet_id_must_be_a_number(self):
        for fleet in ("8;reboot", "", "../8"):
            result = self.enroll(fleet, "fleet8.example.org", self.bootstrap)
            self.assertNotEqual(result.returncode, 0, fleet)
        self.assertNotIn("ssh ", self.box.recorded())


class StageMigrationTest(unittest.TestCase):
    """Copies the fleet tunnels from the running server to its replacement and starts
    nothing there. The stub ssh runs each remote command here, against one directory
    standing in for each server's /etc."""

    FLEETS = {"6": "fd0f:77ac:4fdf:6::19", "71": "fd0f:77ac:4fdf:47::19", "7": "fd0f:77ac:4fdf:7::1:19"}

    def setUp(self):
        self.box = Sandbox()
        self.addCleanup(self.box.cleanup)
        self.old = os.path.join(self.box.dir, "old-etc")
        self.new = os.path.join(self.box.dir, "new-etc")
        os.makedirs(os.path.join(self.old, "wireguard"))
        os.makedirs(os.path.join(self.old, "jaiabot"))
        for fleet, address in self.FLEETS.items():
            self.write(self.old, "wireguard/wg_jaia_ch{}.conf".format(fleet),
                       "[Interface]\nPrivateKey = secret-of-fleet-{}\nAddress = {}/128\n".format(fleet, address))
        self.write(self.old, "wireguard/wg_jaia_ch67", "a stray copy\n")
        self.write(self.old, "wireguard/privatekey", "shared-secret\n")
        self.write(self.old, "wireguard/publickey", "shared-public\n")
        self.write(self.old, "jaiabot/iridium.json", "{}\n")
        self.box.stub("ssh", """args=()
while [ $# -gt 0 ]; do case "$1" in -o) shift 2 ;; *) args+=("$1"); shift ;; esac; done
echo "ssh ${args[*]}" >> "$JAIA_TEST_CALLS"
exec bash -c "${args[1]}"
""")
        self.box.stub("sudo", 'while [[ "$1" == *=* ]]; do export "$1"; shift; done\nexec "$@"')
        self.box.stub("systemctl", 'echo "systemctl $*" >> "$JAIA_TEST_CALLS"\n'
                                   '[ "$1" = list-units ] && printf "%s" "${JAIA_TEST_RUNNING:-}"\nexit 0')
        tunnel = os.path.join(self.box.bin, "jaia-iridium-tunnel.sh")
        with open(tunnel, "w") as f:
            f.write(TUNNEL.read_text())
        os.chmod(tunnel, 0o755)
        self.box.stub("jaia-iridium-enroll.sh", "exit 0")
        self.box.env.update(JAIA_OLD_ETC=self.old, JAIA_NEW_ETC=self.new)

    def write(self, root, path, text):
        with open(os.path.join(root, path), "w") as f:
            f.write(text)

    def stage(self, *args):
        return subprocess.run(["bash", str(STAGE)] + list(args), capture_output=True, text=True,
                              env=self.box.env, timeout=30)

    def staged(self):
        return sorted(os.listdir(os.path.join(self.new, "wireguard")))

    def test_release_2_tunnels_and_the_settings_are_copied(self):
        result = self.stage("new.example.org")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.staged(), ["privatekey", "publickey", "wg_jaia_ch6.conf", "wg_jaia_ch71.conf"])
        with open(os.path.join(self.new, "wireguard", "wg_jaia_ch71.conf")) as f:
            self.assertIn("secret-of-fleet-71", f.read())
        self.assertTrue(os.path.exists(os.path.join(self.new, "jaiabot", "iridium.json")))

    def test_release_3_fleets_are_left_to_enroll_again(self):
        result = self.stage("new.example.org")
        self.assertNotIn("wg_jaia_ch7.conf", self.staged())
        self.assertIn("fleet 7 is release 3", result.stdout)

    def test_release_3_fleets_can_be_carried_too(self):
        result = self.stage("--include-release-3", "new.example.org", "7")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("wg_jaia_ch7.conf", self.staged())

    def test_only_the_named_fleets_are_copied(self):
        self.assertEqual(self.stage("new.example.org", "71").returncode, 0)
        self.assertEqual(self.staged(), ["privatekey", "publickey", "wg_jaia_ch71.conf"])

    def test_a_fleet_the_old_server_lacks_stops_everything(self):
        result = self.stage("new.example.org", "71", "99")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.new, "wireguard")))

    def test_the_keys_are_readable_only_by_root(self):
        self.assertEqual(self.stage("new.example.org").returncode, 0)
        wireguard = os.path.join(self.new, "wireguard")
        self.assertEqual(stat.S_IMODE(os.stat(wireguard).st_mode), 0o700)
        for name in self.staged():
            self.assertEqual(stat.S_IMODE(os.stat(os.path.join(wireguard, name)).st_mode), 0o600, name)

    def test_no_key_is_ever_on_a_command_line(self):
        self.assertEqual(self.stage("new.example.org").returncode, 0)
        calls = self.box.recorded()
        self.assertNotIn("secret", calls)

    def test_each_relay_reports_its_cloudhub_and_nothing_is_started(self):
        result = self.stage("new.example.org")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("CloudHub fd0f:77ac:4fdf:47::1e", result.stdout)
        self.assertIn("CloudHub fd0f:77ac:4fdf:6::1e", result.stdout)
        for line in self.box.recorded().splitlines():
            if line.startswith("systemctl"):
                self.assertTrue(line.startswith("systemctl list-units"), line)

    def test_a_new_server_already_running_fleets_is_refused(self):
        self.box.env["JAIA_TEST_RUNNING"] = "wg-quick@wg_jaia_ch71.service\n"
        result = self.stage("new.example.org")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already runs", result.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.new, "wireguard")))

    def test_a_new_server_without_the_release_3_scripts_is_refused(self):
        os.remove(os.path.join(self.box.bin, "jaia-iridium-enroll.sh"))
        result = self.stage("new.example.org")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("release 3 iridium scripts", result.stderr)

    def test_the_old_server_defaults_to_iridium_jaia_tech(self):
        self.assertEqual(self.stage("new.example.org").returncode, 0)
        self.assertIn("ssh jaia@iridium.jaia.tech", self.box.recorded())
        self.assertIn("ssh jaia@new.example.org", self.box.recorded())


class PackagingTest(unittest.TestCase):
    def test_both_scripts_are_installed(self):
        cmake = (SOURCE_DIR / "src" / "sh" / "CMakeLists.txt").read_text()
        self.assertIn("system/jaia-iridium-tunnel.sh", cmake)
        self.assertIn("system/jaia-iridium-enroll.sh", cmake)


if __name__ == "__main__":
    unittest.main()
