#!/usr/bin/env python3

"""The REST API config jaia_configure_authelia.sh writes on a CloudHub.

The REST API exits when its config has a field APIConfig no longer knows, and under
mod_wsgi that leaves every /jaia request answering 500 - which JCC shows as
"Connection to Hub Dropped". Both files are read as text here, so the check needs no
build products.
"""

import os
import re
import unittest

SOURCE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
SCRIPT = os.path.join(SOURCE_DIR, "src", "sh", "system", "jaia_configure_authelia.sh")
PROTO = os.path.join(SOURCE_DIR, "src", "lib", "messages", "rest_api.proto")


class RestApiConfigTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(SCRIPT) as f:
            found = re.search(r"> /etc/jaiabot/rest_api\.pb\.cfg\n(.*?)^EOF", f.read(),
                              re.DOTALL | re.MULTILINE)
        assert found, "the script no longer writes rest_api.pb.cfg"
        cls.config = found.group(1)
        with open(PROTO) as f:
            message = re.search(r"message APIConfig\n\{(.*?)^\}", f.read(), re.DOTALL | re.MULTILINE)
        assert message, "rest_api.proto no longer defines APIConfig"
        # Nested message definitions are not fields of their own
        body = re.sub(r"message \w+\s*\{.*?\n    \}", "", message.group(1), flags=re.DOTALL)
        cls.fields = set(re.findall(r"^\s*(?:optional|required|repeated)\s+\S+\s+(\w+)\s*=", body,
                                    re.MULTILINE))

    def test_every_top_level_entry_is_a_field_of_apiconfig(self):
        written = set(re.findall(r"^(\w+)\s*[{:]", self.config, re.MULTILINE))
        self.assertTrue(written, "the config is empty")
        self.assertEqual(written - self.fields, set(),
                         "fields the REST API would refuse: {}".format(sorted(written - self.fields)))

    def test_the_streaming_endpoint_is_the_cloudhubs_own_web_portal(self):
        self.assertIn("hub_id: $jaia_hub_id", self.config)
        self.assertIn('hostname: "::1"', self.config)
        self.assertIn("port: 40000", self.config)


if __name__ == "__main__":
    unittest.main()
