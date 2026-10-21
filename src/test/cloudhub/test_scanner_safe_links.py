#!/usr/bin/env python3
"""The links in Authelia's emails are answered with a Continue page until the person
has pressed its button, so a mail scanner that opens them spends nothing."""

import pathlib
import re
import shutil
import subprocess
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
CONFIGURE = SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh"
WEB = SOURCE_DIR / "src" / "web" / "cloud" / "_jaia"
PORTAL = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-portal.py"

LINKS = ["/reset-password/step2", "/revoke/reset-password", "/revoke/one-time-code"]


def auth_site():
    text = CONFIGURE.read_text()
    start = text.index("auth.$base_uri {")
    return text[start:text.index("\n}\n", start)]


class CaddyTest(unittest.TestCase):
    def test_every_emailed_link_is_held_until_confirmed(self):
        site = auth_site()
        matcher = re.search(r"@unconfirmed_link \{(.*?)\n\s*\}", site, re.DOTALL).group(1)
        self.assertIn("method GET", matcher)
        self.assertIn("not query confirmed=1", matcher)
        paths = re.search(r"path (.*)", matcher).group(1).split()
        self.assertEqual(sorted(paths), sorted(LINKS))

    def test_the_continue_page_is_served_before_the_proxy(self):
        site = auth_site()
        held = site.index("handle @unconfirmed_link")
        self.assertLess(held, site.index("import jaia_nav_proxy"))
        block = site[held:site.index("handle {", held)]
        self.assertIn("rewrite * /_jaia/continue.html", block)
        self.assertIn("root * $jaia_cloud_web_dir", block)
        self.assertIn("file_server", block)
        self.assertIn("Cache-Control no-store", block)

    def test_nothing_else_on_the_portal_changed(self):
        self.assertEqual(auth_site().count("handle"), 2)


class ContinuePageTest(unittest.TestCase):
    def test_the_page_and_its_script_exist_and_use_only_local_files(self):
        page = (WEB / "continue.html").read_text()
        for ref in re.findall(r'(?:href|src)="([^"]+)"', page):
            self.assertTrue(ref.startswith("/_jaia/"), ref)
            self.assertTrue((WEB / ref[len("/_jaia/"):]).exists(), ref)
        self.assertIn("/_jaia/support.css", page)
        self.assertIn("data-jaia-continue", page)
        self.assertNotIn("<a ", page, "a link in the page is something a scanner can follow")
        self.assertIn("confirmed=1", page)

    @unittest.skipUnless(shutil.which("node"), "node is not installed")
    def test_the_button_adds_confirmed_to_the_same_address(self):
        script = "const m = require({!r}); for (const u of process.argv.slice(1)) console.log(m.confirmedUrl(u));".format(
            str(WEB / "continue.js"))
        urls = ["https://auth.fleet9.jaia.tech/reset-password/step2?token=abc.def",
                "https://auth.fleet9.jaia.tech/revoke/one-time-code?id=xyz#frag",
                "https://auth.fleet9.jaia.tech/reset-password/step2?token=abc&confirmed=1"]
        out = subprocess.run(["node", "-e", script, "--"] + urls, capture_output=True, text=True, check=True).stdout.split()
        self.assertEqual(out, ["https://auth.fleet9.jaia.tech/reset-password/step2?token=abc.def&confirmed=1",
                               "https://auth.fleet9.jaia.tech/revoke/one-time-code?id=xyz&confirmed=1#frag",
                               "https://auth.fleet9.jaia.tech/reset-password/step2?token=abc&confirmed=1"])


class SupportStyleTest(unittest.TestCase):
    def test_the_support_page_takes_its_style_from_the_shared_stylesheet(self):
        portal = PORTAL.read_text()
        self.assertIn('/_jaia/support.css', portal)
        self.assertNotIn("<style>", portal)
        self.assertNotIn("unsafe-inline", portal)
        css = (WEB / "support.css").read_text()
        self.assertIn("body {", css)
        self.assertIn("button {", css)


if __name__ == "__main__":
    unittest.main()
