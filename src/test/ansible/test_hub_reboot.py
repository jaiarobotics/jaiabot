"""How the JCU's playbooks reboot the hub they run on.

The JCU sends the browser to its reboot page only once it has the playbook's result,
so a hub that reboots before ansible-playbook exits leaves the page dead.
"""

import pathlib
import re
import subprocess
import time
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[3]
ANSIBLE_DIR = ROOT / "config" / "ansible"
TEMPLATES = (ROOT / "config" / "templates" / "hub").glob("*.pb.cfg.in")
REBOOT_TASKS = "tasks/reboot-after-playbook.yml"
# Reboots from a script of its own once the new image is in place
OWN_REBOOT = {"major_upgrade/major-upgrade.yml"}


def hub_reboot_playbooks():
    found = set()
    for template in TEMPLATES:
        for block in re.split(r"ansible_playbook\s*{", template.read_text())[1:]:
            file = re.search(r'file:\s*"([^"]+)"', block)
            if file and re.search(r"causes_hub_reboot:\s*true", block.split("ansible_playbook")[0]):
                found.add(file.group(1))
    return found


def includes(path):
    text = (ANSIBLE_DIR / path).read_text()
    return re.findall(r"include_tasks:\s*(\S+)", text)


class HubRebootTest(unittest.TestCase):
    def test_hub_reboot_playbooks_wait_for_the_playbook(self):
        playbooks = hub_reboot_playbooks()
        self.assertIn("upgrade-all.yml", playbooks)
        self.assertIn("install.yml", playbooks)
        for playbook in sorted(playbooks - OWN_REBOOT):
            self.assertIn(REBOOT_TASKS, includes(playbook), playbook)

    def test_no_fixed_delay_reboots_are_left(self):
        for path in ANSIBLE_DIR.rglob("*.yml"):
            self.assertNotRegex(path.read_text(), r"sleep \d+ && systemctl reboot", str(path))

    def test_waits_for_ansible_playbook_to_exit(self):
        shell = yaml.safe_load((ANSIBLE_DIR / REBOOT_TASKS).read_text())[0]["shell"]
        inner = re.search(r"/bin/bash -c '([^']*)'", shell).group(1)
        self.assertIn("systemctl reboot", inner)
        inner = inner.replace("sleep 5; systemctl reboot", "echo rebooting")

        playbook = subprocess.Popen(["bash", "-c", "exec -a ansible-playbook sleep 3"])
        self.addCleanup(playbook.kill)
        time.sleep(0.5)
        started = time.monotonic()
        out = subprocess.run(["bash", "-c", inner], capture_output=True, text=True, timeout=30)
        waited = time.monotonic() - started

        self.assertEqual(out.stdout.strip(), "rebooting")
        self.assertGreater(waited, 2)
        self.assertLess(waited, 10)

    def test_reboots_without_waiting_where_no_playbook_runs(self):
        shell = yaml.safe_load((ANSIBLE_DIR / REBOOT_TASKS).read_text())[0]["shell"]
        inner = re.search(r"/bin/bash -c '([^']*)'", shell).group(1)
        inner = inner.replace("sleep 5; systemctl reboot", "echo rebooting")
        started = time.monotonic()
        out = subprocess.run(["bash", "-c", inner], capture_output=True, text=True, timeout=30)
        self.assertEqual(out.stdout.strip(), "rebooting")
        self.assertLess(time.monotonic() - started, 2)


if __name__ == "__main__":
    unittest.main()
