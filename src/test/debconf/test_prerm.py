#!/usr/bin/env python3

"""What jaiabot-embedded's prerm stops.

dpkg-reconfigure runs the prerm as 'upgrade' before the postinst, and a JCU
settings playbook (Comms Links, the DCCL password) runs dpkg-reconfigure on the
node, so a prerm that stopped the JCU killed the playbook that called it. On an
upgrade it is left running; its regenerated unit takes effect at the next reboot.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
PRERM = SOURCE_DIR / "debian" / "jaiabot-embedded.prerm"

JCU = "jaiabot_goby_liaison_standalone.service"
UNITS = ["jaiabot_dns.service", JCU, "jaiabot_update_ufw_rules.service", "jaia_firm_backup_date_sh.service"]


class PrermTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.units = os.path.join(self.dir, "systemd")
        os.makedirs(self.units)
        for unit in UNITS:
            open(os.path.join(self.units, unit), "w").close()
        self.calls = os.path.join(self.dir, "calls")
        systemctl = os.path.join(self.dir, "systemctl")
        with open(systemctl, "w") as f:
            f.write('#!/bin/sh\necho "systemctl $*" >> "%s"\n' % self.calls)
        os.chmod(systemctl, 0o755)
        self.env = dict(os.environ, JAIA_SYSTEMD_DIR=self.units, JAIA_SYSTEMCTL=systemctl)

    def run_prerm(self, action):
        result = subprocess.run(["bash", str(PRERM), action], capture_output=True, text=True, env=self.env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        with open(self.calls) as f:
            return f.read()

    def test_an_upgrade_or_reconfigure_leaves_the_jcu_running(self):
        calls = self.run_prerm("upgrade")
        self.assertNotIn("stop " + JCU, calls)

    def test_an_upgrade_still_stops_everything_else(self):
        calls = self.run_prerm("upgrade")
        self.assertIn("stop jaiabot\n", calls)
        for unit in UNITS:
            if unit != JCU:
                self.assertIn("stop " + unit, calls)

    def test_an_upgrade_still_replaces_the_jcu_unit(self):
        """So the postinst writes the new one, which systemd uses from the next reboot"""
        calls = self.run_prerm("upgrade")
        self.assertIn(JCU, [line for line in calls.splitlines() if line.startswith("systemctl disable")][0])
        self.assertFalse(os.path.exists(os.path.join(self.units, JCU)))

    def test_a_removal_stops_the_jcu_too(self):
        calls = self.run_prerm("remove")
        self.assertIn("stop " + JCU, calls)


if __name__ == "__main__":
    unittest.main()
