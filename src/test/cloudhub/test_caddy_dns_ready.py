#!/usr/bin/env python3
"""Caddy is held until its names resolve to the CloudHub, so that Let's Encrypt is
not asked (and does not back off) before the technician has added the DNS records."""

import os
import pathlib
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-caddy-dns-ready.sh"
CONFIGURE = SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh"

CURL_STUB = """#!/bin/bash
for arg; do [[ "$arg" == http* ]] && url=$arg; done
case "$url" in
    */api/token) echo token ;;
    */meta-data/public-ipv4) [ -n "$STUB_IPV4" ] && echo "$STUB_IPV4" || exit 22 ;;
    */meta-data/mac) echo 0a:00:00:00:00:01 ;;
    */ipv6s) echo "$STUB_IPV6" ;;
    *) exit 22 ;;
esac
"""

# STUB_V4/STUB_V6: "name=addr,name=addr", what the zone's name servers answer
LOOKUP_STUB = """#!/bin/bash
name=$1 rtype=$2
[ "$rtype" = A ] && table=$STUB_V4 || table=$STUB_V6
for entry in ${table//,/ }; do
    [ "${entry%%=*}" = "$name" ] && echo "${entry#*=}"
done
exit 0
"""

NAMES = ["fleet7.jaia.tech", "run.fleet7.jaia.tech"]


class CaddyDnsReadyTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.bin = os.path.join(self._tmp.name, "bin")
        os.makedirs(self.bin)
        for name, body in (("curl", CURL_STUB), ("jaia-dns-lookup.py", LOOKUP_STUB)):
            path = os.path.join(self.bin, name)
            with open(path, "w") as f:
                f.write(body)
            os.chmod(path, 0o755)

    def ready(self, v4="", v6="", ipv4="203.0.113.7", ipv6="2001:db8::7"):
        env = dict(os.environ, PATH=self.bin + os.pathsep + os.environ["PATH"],
                   STUB_IPV4=ipv4, STUB_IPV6=ipv6, STUB_V4=v4, STUB_V6=v6)
        return subprocess.run(["bash", str(SCRIPT)] + NAMES, env=env, capture_output=True, text=True)

    def test_ready_when_every_name_resolves_here(self):
        result = self.ready(v4="fleet7.jaia.tech=203.0.113.7,run.fleet7.jaia.tech=203.0.113.7",
                            v6="fleet7.jaia.tech=2001:db8::7,run.fleet7.jaia.tech=2001:db8::7")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_ready_with_no_aaaa_records(self):
        result = self.ready(v4="fleet7.jaia.tech=203.0.113.7,run.fleet7.jaia.tech=203.0.113.7")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_waits_while_a_name_does_not_resolve(self):
        result = self.ready(v4="fleet7.jaia.tech=203.0.113.7")
        self.assertEqual(result.returncode, 1)
        self.assertIn("Waiting for run.fleet7.jaia.tech to resolve to 203.0.113.7 (now: nothing)", result.stdout)

    def test_waits_while_a_name_resolves_to_another_address(self):
        """A record left over from an earlier CloudHub fails validation just as a missing one does."""
        result = self.ready(v4="fleet7.jaia.tech=198.51.100.1,run.fleet7.jaia.tech=203.0.113.7")
        self.assertEqual(result.returncode, 1)
        self.assertIn("(now: 198.51.100.1)", result.stdout)

    def test_waits_while_an_aaaa_record_is_stale(self):
        result = self.ready(v4="fleet7.jaia.tech=203.0.113.7,run.fleet7.jaia.tech=203.0.113.7",
                            v6="run.fleet7.jaia.tech=2001:db8::99")
        self.assertEqual(result.returncode, 1)
        self.assertIn("IPv6", result.stdout)

    def test_waits_without_a_public_address(self):
        result = self.ready(v4="fleet7.jaia.tech=203.0.113.7,run.fleet7.jaia.tech=203.0.113.7", ipv4="")
        self.assertEqual(result.returncode, 1)


class ConfigureHoldsCaddyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = CONFIGURE.read_text()

    def test_the_condition_is_in_place_before_caddy_is_restarted(self):
        self.assertLess(self.text.index("ExecCondition=+/usr/bin/jaia-caddy-dns-ready.sh"),
                        self.text.index("systemctl restart caddy"))
        self.assertLess(self.text.index("systemctl daemon-reload"), self.text.index("systemctl restart caddy"))

    def test_every_site_is_waited_for(self):
        sites = {line.split()[0].replace("$base_uri", "") for line in self.text.splitlines()
                 if line.endswith("$base_uri {")}
        names = self.text[self.text.index("caddy_names=("):].split(")", 1)[0]
        for site in sites:
            self.assertIn('"{}$base_uri"'.format(site), names)


if __name__ == "__main__":
    unittest.main()
