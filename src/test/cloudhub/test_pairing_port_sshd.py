#!/usr/bin/env python3
"""The pairing port admits the bootstrap key to the enrollment command and nothing else.

Fleet pairing opens the port to every address, so what sshd does there is the whole
of what pairing exposes. These ask sshd itself, with the drop-in exactly as
jaia_configure_authelia.sh writes it, rather than reading the text.
"""

import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
CONFIGURE = SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh"
NODE_SSHD = (SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "ssh"
             / "sshd_config.d" / "jaia_sshd.conf")
SSHD = shutil.which("sshd") or ("/usr/sbin/sshd" if os.path.exists("/usr/sbin/sshd") else None)

PAIRING_KEYS = "/etc/jaiabot/ssh/pairing_authorized_keys"
ENROLL = "/usr/bin/jaia-vpn-enroll.sh"


def configure_text():
    return CONFIGURE.read_text()


def pairing_port():
    return int(re.search(r"^pairing_port=(\d+)$", configure_text(), re.MULTILINE).group(1))


def pairing_dropin():
    body = re.search(r'cat > "\$sshd_pairing_conf\.new" <<EOF\n(.*?)\nEOF\n', configure_text(),
                     re.DOTALL).group(1)
    return body.replace("$pairing_port", str(pairing_port()))


@unittest.skipIf(SSHD is None, "sshd is not installed")
class PairingPortTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        host_key = os.path.join(self.dir, "host_key")
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", host_key], check=True)
        self.config = os.path.join(self.dir, "sshd_config")
        with open(self.config, "w") as f:
            f.write("HostKey {}\nPidFile none\n".format(host_key))
            f.write(NODE_SSHD.read_text())
            f.write("Port 22\nPort {}\n".format(pairing_port()))
            f.write(pairing_dropin() + "\n")

    def effective(self, user, port):
        done = subprocess.run([SSHD, "-T", "-f", self.config, "-C",
                               "user={},host=h,addr=203.0.113.9,lport={}".format(user, port)],
                              capture_output=True, text=True)
        self.assertEqual(0, done.returncode, done.stderr)
        return dict(line.split(" ", 1) for line in done.stdout.splitlines() if " " in line)

    def test_the_config_is_valid(self):
        done = subprocess.run([SSHD, "-t", "-f", self.config], capture_output=True, text=True)
        self.assertEqual(0, done.returncode, done.stderr)

    def test_jaia_on_the_pairing_port_gets_the_enrollment_command_only(self):
        held = self.effective("jaia", pairing_port())
        self.assertEqual(PAIRING_KEYS, held["authorizedkeysfile"])
        self.assertEqual(ENROLL, held["forcecommand"])
        self.assertEqual("no", held["permittty"])
        self.assertEqual("yes", held["disableforwarding"])
        self.assertEqual("no", held["permituserrc"])
        self.assertEqual("publickey", held["authenticationmethods"])

    def test_no_other_user_has_keys_on_the_pairing_port(self):
        for user in ("root", "ubuntu", "jaia_support"):
            held = self.effective(user, pairing_port())
            self.assertEqual("none", held["authorizedkeysfile"], user)

    def test_port_22_is_unchanged(self):
        held = self.effective("jaia", 22)
        self.assertIn("/etc/jaiabot/ssh/root_authorized_keys", held["authorizedkeysfile"])
        self.assertNotIn(PAIRING_KEYS, held["authorizedkeysfile"])
        self.assertEqual("none", held["forcecommand"])


class SocketTest(unittest.TestCase):
    def test_a_socket_activated_sshd_listens_on_the_pairing_port(self):
        text = configure_text()
        dropin = re.search(r"cat > /etc/systemd/system/ssh\.socket\.d/jaia-pairing\.conf <<EOF\n(.*?)\nEOF",
                           text, re.DOTALL).group(1)
        # Ubuntu's ssh.socket has BindIPv6Only=ipv6-only, so a bare port would be IPv6 alone
        self.assertIn("ListenStream=0.0.0.0:$pairing_port", dropin)
        self.assertIn("ListenStream=[::]:$pairing_port", dropin)
        self.assertNotRegex(dropin, r"^ListenStream=\$pairing_port$")
        self.assertIn("systemctl restart ssh.socket", text)

    def test_the_config_is_checked_before_sshd_is_restarted(self):
        text = configure_text()
        checked = re.search(r"^\s*sshd -t$", text, re.MULTILINE).start()
        self.assertLess(checked, text.index("systemctl restart ssh.socket"))


if __name__ == "__main__":
    unittest.main()
