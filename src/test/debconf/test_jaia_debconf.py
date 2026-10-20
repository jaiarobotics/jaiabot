#!/usr/bin/env python3

"""Setting a debconf value over SSH, and what a reconfigure leaves running.

Both came up changing a hub's comms links with 'jaia admin debconf set' over SSH:
the set reported failure though the value was saved, so the reconfigure was
skipped; and the reconfigure, once run, left jaiabot and the hub's DNS, firewall
and JCU services stopped until someone started them by hand.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-debconf.sh"

FALLBACK_WARNING = ("debconf: unable to initialize frontend: Dialog\n"
                    "debconf: (This frontend requires a controlling tty.)\n"
                    "debconf: falling back to frontend: Noninteractive")

RUNNING = ["jaiabot.service", "jaiabot_dns.service", "jaiabot_goby_liaison_standalone.service",
           "jaiabot_update_ufw_rules.service", "gpsd.service"]

STUBS = {
    # Answers every command on stdout; warns on stderr as debconf does without a
    # terminal unless told to use the noninteractive frontend
    "debconf-communicate": """
[ "${DEBIAN_FRONTEND:-}" = noninteractive ] || [ -z "${JAIA_TEST_WARN:-}" ] || echo "%(warning)s" >&2
while read -r line; do
    echo "debconf-communicate $line" >> "$JAIA_TEST_CALLS"
    echo "${JAIA_TEST_REPLY-0 value set}"
done
""" % {"warning": FALLBACK_WARNING},
    "dpkg-reconfigure": 'echo "dpkg-reconfigure $*" >> "$JAIA_TEST_CALLS"\n'
                        'exit ${JAIA_TEST_RECONFIGURE_STATUS:-0}\n',
    "systemctl": """
case "$1" in
    list-units) for u in ${JAIA_TEST_RUNNING:-}; do echo "$u loaded active running x"; done ;;
    *) echo "systemctl $*" >> "$JAIA_TEST_CALLS" ;;
esac
""",
}


class DebconfTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.calls = os.path.join(self.dir, "calls")
        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        for name, body in STUBS.items():
            path = os.path.join(fake_bin, name)
            with open(path, "w") as f:
                f.write("#!/bin/sh\n" + body)
            os.chmod(path, 0o755)
        self.env = dict(os.environ, PATH=fake_bin + os.pathsep + os.environ["PATH"],
                        JAIA_TEST_CALLS=self.calls, JAIA_TEST_RUNNING=" ".join(RUNNING))
        self.env.pop("DEBIAN_FRONTEND", None)

    def run_script(self, *args):
        return subprocess.run(["bash", str(SCRIPT)] + list(args), capture_output=True, text=True,
                              env=self.env)

    def recorded(self):
        if not os.path.exists(self.calls):
            return ""
        with open(self.calls) as f:
            return f.read()

    ## Setting a value without a terminal

    def test_a_set_over_ssh_succeeds_despite_the_frontend_warning(self):
        self.env["JAIA_TEST_WARN"] = "1"
        result = self.run_script("set", "comms_links", "wifi")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Set jaiabot-embedded/comms_links to 'wifi'", result.stdout)
        self.assertNotIn("could not set", result.stderr)

    def test_a_set_over_ssh_goes_on_to_reconfigure(self):
        self.env["JAIA_TEST_WARN"] = "1"
        self.run_script("set", "comms_links", "wifi")
        self.assertIn("dpkg-reconfigure -f noninteractive jaiabot-embedded", self.recorded())

    def test_the_value_is_written(self):
        self.run_script("set", "comms_links", "wifi")
        self.assertIn("debconf-communicate SET jaiabot-embedded/comms_links wifi", self.recorded())

    def test_a_refused_set_still_fails_and_says_why(self):
        self.env["JAIA_TEST_REPLY"] = "10 jaiabot-embedded/comms_links doesn't exist"
        result = self.run_script("set", "comms_links", "wifi")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not set jaiabot-embedded/comms_links", result.stderr)
        self.assertIn("doesn't exist", result.stderr)
        self.assertNotIn("dpkg-reconfigure", self.recorded())

    def test_no_reply_at_all_is_a_failure(self):
        self.env["JAIA_TEST_REPLY"] = ""
        result = self.run_script("set", "comms_links", "wifi")
        self.assertNotEqual(result.returncode, 0)

    def test_an_invalid_value_is_still_refused_before_debconf(self):
        result = self.run_script("set", "comms_links", "carrier-pigeon")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a valid value", result.stderr)
        self.assertEqual("", self.recorded())

    ## What a reconfigure leaves running

    def test_a_reconfigure_starts_again_what_was_running(self):
        self.run_script("set", "comms_links", "wifi")
        calls = self.recorded()
        self.assertIn("systemctl start " + " ".join(RUNNING), calls)
        self.assertLess(calls.index("dpkg-reconfigure"), calls.index("systemctl start"))

    def test_a_reconfigure_starts_nothing_that_was_not_running(self):
        self.env["JAIA_TEST_RUNNING"] = "jaiabot_dns.service"
        self.run_script("reconfigure")
        self.assertIn("systemctl start jaiabot_dns.service\n", self.recorded())

    def test_with_nothing_running_nothing_is_started(self):
        self.env["JAIA_TEST_RUNNING"] = ""
        result = self.run_script("reconfigure")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("systemctl start", self.recorded())

    def test_a_failed_reconfigure_still_restores_the_services_and_fails(self):
        self.env["JAIA_TEST_RECONFIGURE_STATUS"] = "1"
        result = self.run_script("reconfigure")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("systemctl start", self.recorded())

    def test_no_reconfigure_means_no_restart_either(self):
        result = self.run_script("set", "comms_links", "wifi", "--no-reconfigure")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("dpkg-reconfigure", self.recorded())
        self.assertNotIn("systemctl start", self.recorded())


class PlaybookTest(unittest.TestCase):
    """The JCU's settings playbooks reconfigure the same way the tool does"""

    def test_no_playbook_runs_dpkg_reconfigure_itself(self):
        offenders = [str(p.relative_to(SOURCE_DIR)) for p in (SOURCE_DIR / "config" / "ansible").rglob("*.yml")
                     if "dpkg-reconfigure" in p.read_text()]
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
