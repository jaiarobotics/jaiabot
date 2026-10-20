"""What the JCU's Comms Links and Pair Fleet to CloudHub playbooks accept and report.

Comms Links offered "xbee,iridium,wifi" while its playbook allowed that set only as
"xbee,wifi,iridium", so choosing it failed. Pair Fleet to CloudHub reported every
node as changed, already paired or not. Both are checked by running the playbooks'
own expressions through ansible-playbook on localhost, so need ansible installed.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import textwrap
import unittest

import yaml

ANSIBLE_DIR = pathlib.Path(__file__).resolve().parents[3] / "config" / "ansible"


def play(path):
    with open(ANSIBLE_DIR / path) as f:
        return yaml.safe_load(f)[0]


@unittest.skipUnless(shutil.which("ansible-playbook"), "needs ansible-playbook")
class JcuPlaybookTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)

    def run_play(self, tasks, extra_vars=None, play_vars=None):
        path = os.path.join(self.dir, "play.yml")
        with open(path, "w") as f:
            yaml.safe_dump([{"hosts": "localhost", "gather_facts": False, "connection": "local",
                             "vars": play_vars or {}, "tasks": tasks}], f)
        cmd = ["ansible-playbook", "-i", "localhost,", path]
        for k, v in (extra_vars or {}).items():
            cmd += ["-e", "{}={}".format(k, v)]
        env = dict(os.environ, ANSIBLE_NOCOLOR="1", ANSIBLE_LOCALHOST_WARNING="false")
        return subprocess.run(cmd, capture_output=True, text=True, env=env)

    def comms_check(self, value):
        comms = play("change-comms-links.yml")
        extra = {} if value is None else {"comms_link": value}
        return self.run_play(comms["pre_tasks"], extra, comms["vars"])

    def test_every_set_of_known_links_is_accepted_in_any_order(self):
        for value in ("wifi", "xbee", "iridium", "xbee,wifi", "wifi,xbee", "wifi,iridium",
                      "xbee,iridium,wifi", "iridium, xbee, wifi"):
            result = self.comms_check(value)
            self.assertEqual(result.returncode, 0, "{}: {}".format(value, result.stdout[-400:]))

    def test_unknown_repeated_or_missing_links_are_refused(self):
        for value in ("lora", "wifi,lora", "wifi,wifi", "", None):
            result = self.comms_check(value)
            self.assertNotEqual(result.returncode, 0, "{!r} was accepted".format(value))

    def test_every_choice_the_jcu_offers_is_accepted(self):
        hub_py = (ANSIBLE_DIR.parent / "gen" / "hub.py").read_text()
        choices = eval(hub_py.split("comms_link_choices=", 1)[1].split("\n", 1)[0])
        for value in choices:
            self.assertEqual(self.comms_check(value).returncode, 0, value)

    def test_pairing_reports_changed_only_for_nodes_it_paired(self):
        task = next(t for t in play("pair-fleet-to-cloudhub.yml")["tasks"] if "register" in t)
        expected = {
            "Paired with fleet7.jaia.tech": True,
            "Paired with fleet7.jaia.tech; the CloudHub VPN is not set to start at boot, so it is left stopped": True,
            "The tunnel to fleet7.jaia.tech has not handshaken in over 300 seconds; pairing again\n"
            "Paired with fleet7.jaia.tech": True,
            "Already paired with fleet7.jaia.tech": False,
            "Not paired, and no bootstrap key (id_vpn_tmp) to pair with": False,
            "No CloudHub given, not pairing": False,
        }
        for stdout, changed in expected.items():
            script = os.path.join(self.dir, "pair.sh")
            with open(script, "w") as f:
                f.write("#!/bin/sh\ncat <<'EOF'\n{}\nEOF\n".format(stdout))
            os.chmod(script, 0o755)
            result = self.run_play([{"name": "pair", "shell": script, "register": task["register"],
                                     "changed_when": task["changed_when"]}])
            self.assertEqual(result.returncode, 0, result.stdout[-400:])
            self.assertIn("changed={}".format(1 if changed else 0), result.stdout, stdout)


if __name__ == "__main__":
    unittest.main()
