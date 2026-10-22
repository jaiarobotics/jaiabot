#!/usr/bin/env python3
"""The part of create_vpc.sh that logs in to a new CloudHub, run against a stand-in
CloudHub. With a hardware (-sk) key every login is a touch of the Yubikey, so waiting
for first boot must not cost one per poll."""

import os
import pathlib
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
CREATE_VPC = SOURCE_DIR / "rootfs" / "cloud" / "aws" / "create_vpc.sh"

# Refuses the first few connections, as sshd does while the instance boots, then
# runs the command as the CloudHub would and logs it as a login
SSH_STUB = """#!/bin/bash
n=$(( $(cat "$STUB_DIR/connects" 2>/dev/null || echo 0) + 1 ))
echo $n > "$STUB_DIR/connects"
if (( n <= ${STUB_REFUSED:-0} )); then
    echo "ssh: connect to host: Connection refused" >&2
    exit 255
fi
echo login >> "$STUB_DIR/logins"
exec bash -c "${@: -1}"
"""

# overlayroot appears only after the CloudHub has polled a while, as after the reboot
MOUNT_STUB = """#!/bin/bash
n=$(( $(cat "$STUB_DIR/mounts" 2>/dev/null || echo 0) + 1 ))
echo $n > "$STUB_DIR/mounts"
(( n > ${STUB_POLLS_BEFORE_OVERLAY:-0} )) && echo "overlayroot on / type overlay"
echo "/dev/root on /media/root-ro type ext4"
"""

STUBS = {
    "ssh": SSH_STUB,
    "mount": MOUNT_STUB,
    "sudo": '#!/bin/bash\nexec "$@"\n',
    "sleep": "#!/bin/bash\n",
    "ufw": '#!/bin/bash\necho "ufw $*" >> "$STUB_DIR/ufw"\nexit ${STUB_UFW_STATUS:-0}\n',
    "jaia-support-access.py": '#!/bin/bash\necho "$*" >> "$STUB_DIR/reconcile"\nexit ${STUB_RECONCILE_STATUS:-0}\n',
    "jaia": '#!/bin/bash\ncp "${@: -1}" "$STUB_DIR/recorded_key"\n',
}


def login_section(root):
    text = CREATE_VPC.read_text()
    start = text.index("# No connection sharing")
    end = text.index("\n", text.index("Handed port 22 to the CloudHub"))
    section = text[start:end]
    for path in ("/home/jaia", "/etc/wireguard", "/var/log/jaiabot"):
        section = section.replace(path, root + path)
    return section


class CreateVpcLoginTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = self._tmp.name
        self.bin = os.path.join(self.dir, "bin")
        os.makedirs(self.bin)
        for name, body in STUBS.items():
            path = os.path.join(self.bin, name)
            with open(path, "w") as f:
                f.write(body)
            os.chmod(path, 0o755)
        root = os.path.join(self.dir, "root")
        os.makedirs(os.path.join(root, "home/jaia/.ssh"))
        os.makedirs(os.path.join(root, "etc/wireguard"))
        with open(os.path.join(root, "etc/wireguard/publickey"), "w") as f:
            f.write("wgpub=\n")
        with open(os.path.join(root, "home/jaia/.ssh/hub30_fleet7.pub"), "w") as f:
            f.write("ssh-ed25519 AAAAhub30 hub30_fleet7\n")
        self.script = "\n".join([
            "set -u -e",
            "PUBLIC_IPV4_ADDRESS=192.0.2.1 CLOUDHUB_ID=30 FLEET_ID=7 FLEET_CONFIG=fleet7.cfg",
            "TMPDIR={} WAIT_TIMEOUT_SECONDS=60".format(self.dir),
            "abort_if_timed_out() { :; }",
            "exit_if_interrupted() { :; }",
            login_section(root),
        ])

    def run_section(self, **env):
        full_env = dict(os.environ, PATH=self.bin + os.pathsep + os.environ["PATH"], STUB_DIR=self.dir,
                        **{k: str(v) for k, v in env.items()})
        return subprocess.run(["bash", "-c", self.script], env=full_env, capture_output=True, text=True,
                              timeout=60)

    def read(self, name):
        path = pathlib.Path(self.dir, name)
        return path.read_text().splitlines() if path.exists() else []

    def test_waiting_for_first_boot_costs_one_login_per_wait(self):
        result = self.run_section(STUB_REFUSED=3, STUB_POLLS_BEFORE_OVERLAY=40)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        # the Wireguard key, the wait for the overlay root with the CloudHub's key, the hand-over
        self.assertEqual(len(self.read("logins")), 3)
        self.assertEqual(self.read("recorded_key"), ["ssh-ed25519 AAAAhub30 hub30_fleet7"])
        self.assertIn("ufw --force enable", self.read("ufw"))
        self.assertEqual(self.read("reconcile"), ["reconcile"])
        self.assertIn("Handed port 22 to the CloudHub", result.stdout)

    def test_a_failed_reconcile_is_left_to_the_cloudhub_timer(self):
        result = self.run_section(STUB_RECONCILE_STATUS=1)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("WARNING: could not reconcile port 22", result.stdout)

    def test_a_failed_firewall_update_stops_before_the_hand_over(self):
        result = self.run_section(STUB_UFW_STATUS=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.read("reconcile"), [])
        self.assertNotIn("Handed port 22", result.stdout)


if __name__ == "__main__":
    unittest.main()
