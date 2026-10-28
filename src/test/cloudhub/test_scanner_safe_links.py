#!/usr/bin/env python3
"""Mail scanners open the links in Authelia's emails and press buttons before the person
does. A reset link only reaches Authelia from the browser that asked for the reset, and
a cancel link only for someone signed in, so a scanner spends and cancels nothing."""

import http.server
import pathlib
import re
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
CONFIGURE = SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh"
COMMON = SOURCE_DIR / "src" / "sh" / "system" / "jaia-authelia-common.sh"
WEB = SOURCE_DIR / "src" / "web" / "cloud" / "_jaia"
PORTAL = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-portal.py"


def auth_site():
    text = CONFIGURE.read_text()
    start = text.index("auth.$base_uri {")
    return text[start:text.index("\n}\n", start) + 2]


def snippet(name):
    """From the CloudHub's script, or the setup it shares with the auth.cloud.jaia.tech server"""
    for text in (CONFIGURE.read_text(), COMMON.read_text()):
        if "(%s) {" % name in text:
            start = text.index("(%s) {" % name)
            return text[start:text.index("\n}\n", start) + 2]
    raise ValueError(name)


def portal():
    return snippet("authelia_portal")


def matcher(site, name):
    return re.search(r"@%s \{(.*?)\n\s*\}" % name, site, re.DOTALL).group(1)


def handle(site, name):
    start = site.index("handle @%s {" % name)
    return site[start:site.index("\n        }\n", start)]


class CaddyTest(unittest.TestCase):
    def test_the_auth_site_is_the_portal_behind_the_menu(self):
        self.assertIn("import authelia_portal jaia_nav_proxy localhost:$authelia_port", auth_site())

    def test_asking_for_a_reset_marks_the_browser(self):
        site = portal()
        self.assertIn("method POST", matcher(site, "reset_requested"))
        self.assertIn("path /api/reset-password/identity/start", matcher(site, "reset_requested"))
        cookie = re.search(r'header \+Set-Cookie "([^"]+)"', handle(site, "reset_requested")).group(1)
        self.assertTrue(cookie.startswith("jaia_reset=1;"), cookie)
        for attribute in ("Path=/", "Max-Age=600", "Secure", "HttpOnly", "SameSite=Lax"):
            self.assertIn(attribute, cookie)
        self.assertNotIn("Domain=", cookie, "the cookie belongs to the auth host alone")

    def test_a_reset_link_without_the_mark_spends_nothing(self):
        site = portal()
        link = matcher(site, "reset_link_elsewhere")
        self.assertIn("path /reset-password/step2", link)
        self.assertIn("not header Cookie *jaia_reset=1*", link)
        self.assertIn("rewrite * /_jaia/reset-elsewhere.html", handle(site, "reset_link_elsewhere"))
        finish = matcher(site, "reset_finish_elsewhere")
        self.assertIn("path /api/reset-password/identity/finish", finish)
        self.assertIn("not header Cookie *jaia_reset=1*", finish)
        self.assertIn("respond 403", handle(site, "reset_finish_elsewhere"))

    def test_cancel_links_and_calls_need_a_sign_in(self):
        site = portal()
        self.assertEqual(sorted(re.search(r"path (.*)", matcher(site, "cancel_link")).group(1).split()),
                         ["/revoke/one-time-code", "/revoke/reset-password"])
        self.assertIn("method DELETE", matcher(site, "cancel_call"))
        self.assertEqual(sorted(re.search(r"path (.*)", matcher(site, "cancel_call")).group(1).split()),
                         ["/api/reset-password", "/api/user/session/elevation/*"])
        for name in ("cancel_link", "cancel_call"):
            block = handle(site, name)
            self.assertLess(block.index("import authelia_forward_auth"), block.index("import {args[:]}"))

    def test_the_continue_page_is_gone(self):
        self.assertNotIn("confirmed=1", CONFIGURE.read_text() + COMMON.read_text())
        self.assertFalse((WEB / "continue.html").exists())
        self.assertFalse((WEB / "continue.js").exists())


class AutheliaTest(unittest.TestCase):
    def test_the_cancel_paths_need_one_factor(self):
        text = COMMON.read_text()
        rules = text[text.index("  rules: # order matters!"):]
        first = rules[:rules.index("\n\n")]
        self.assertIn("- domain: auth.$base_uri", first)
        self.assertIn("policy: one_factor", first)
        for path in ("/revoke/one-time-code", "/api/reset-password", "/api/user/session/elevation/abc"):
            patterns = re.findall(r"- '(\^[^']+)'", first)
            self.assertTrue(any(re.match(p, path) for p in patterns), path)
        self.assertFalse(any(re.match(p, "/api/reset-password/identity/start")
                             for p in re.findall(r"- '(\^[^']+)'", first)))

    def test_rate_limits_fit_an_office_behind_one_address(self):
        text = COMMON.read_text()
        for endpoint in ("reset_password_start", "session_elevation_start", "session_elevation_finish"):
            block = text[text.index("      %s:" % endpoint):]
            block = block[:block.index("requests: 100") + len("requests: 100")]
            self.assertIn("period: '5 minutes'\n            requests: 20", block)
            self.assertIn("period: '1 hour'\n            requests: 100", block)


class ResetElsewherePageTest(unittest.TestCase):
    def test_the_page_uses_only_local_files_and_offers_a_new_reset(self):
        page = (WEB / "reset-elsewhere.html").read_text()
        for ref in re.findall(r'(?:href|src)="([^"]+)"', page):
            if ref.startswith("/_jaia/"):
                self.assertTrue((WEB / ref[len("/_jaia/"):]).exists(), ref)
            else:
                self.assertEqual(ref, "/reset-password/step1")
        self.assertIn("/_jaia/support.css", page)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class StubAuthelia(http.server.BaseHTTPRequestHandler):
    """Records what reaches Authelia; forward-auth passes only a browser holding the stub's session."""
    seen = []

    def answer(self):
        if self.path.startswith("/api/authz/forward-auth"):
            signed_in = "authelia_session=signed-in" in self.headers.get("Cookie", "")
            self.send_response(200 if signed_in else 302)
            if not signed_in:
                self.send_header("Location", "https://auth.example/?rd=x")
            self.end_headers()
            return
        StubAuthelia.seen.append((self.command, self.path))
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"authelia")

    do_GET = do_POST = do_DELETE = do_PUT = answer

    def log_message(self, *args):
        pass


@unittest.skipUnless(shutil.which("caddy"), "caddy is not installed")
class CaddyBehaviourTest(unittest.TestCase):
    """The auth site as written, run by Caddy over plain HTTP in front of a stub Authelia."""

    @classmethod
    def setUpClass(cls):
        stub_port, cls.port = free_port(), free_port()
        cls.stub = http.server.ThreadingHTTPServer(("127.0.0.1", stub_port), StubAuthelia)
        threading.Thread(target=cls.stub.serve_forever, daemon=True).start()
        cls.tmp = tempfile.TemporaryDirectory()
        web = pathlib.Path(cls.tmp.name) / "web"
        shutil.copytree(WEB, web / "_jaia")
        site = auth_site().replace("auth.$base_uri {", "http://127.0.0.1:%d {" % cls.port, 1)
        caddyfile = "{\n        admin off\n        order replace after encode\n}\n" + "\n".join(
            snippet(n) for n in ("authelia_forward_auth", "authelia_portal", "jaia_nav", "jaia_nav_proxy")) + "\n" + site
        caddyfile = (caddyfile.replace("$authelia_port", str(stub_port)).replace("$caddy_tls", "")
                     .replace("$jaia_cloud_web_dir", str(web)).replace("[$vh1_ip]:80", "127.0.0.1:9")
                     .replace("${jaia_fleet_id}", "9"))
        path = pathlib.Path(cls.tmp.name) / "Caddyfile"
        path.write_text(caddyfile)
        cls.caddy = subprocess.Popen(["caddy", "run", "--config", str(path), "--adapter", "caddyfile"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", cls.port), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.caddy.terminate()
        cls.caddy.wait()
        cls.stub.shutdown()
        cls.tmp.cleanup()

    def request(self, method, path, cookie=None):
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (self.port, path), method=method,
                                     data=b"{}" if method in ("POST", "DELETE") else None)
        if cookie:
            req.add_header("Cookie", cookie)
        opener = urllib.request.build_opener(NoRedirect)
        StubAuthelia.seen.clear()
        try:
            with opener.open(req, timeout=5) as r:
                return r.status, r.headers, r.read().decode(), list(StubAuthelia.seen)
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read().decode(), list(StubAuthelia.seen)

    def test_asking_for_a_reset_sets_the_cookie_and_reaches_authelia(self):
        status, headers, _, seen = self.request("POST", "/api/reset-password/identity/start")
        self.assertEqual(status, 200)
        self.assertIn("jaia_reset=1", headers.get("Set-Cookie", ""))
        self.assertEqual(seen, [("POST", "/api/reset-password/identity/start")])

    def test_a_scanner_never_reaches_the_reset(self):
        status, _, body, seen = self.request("GET", "/reset-password/step2?token=t")
        self.assertIn("Open this link where you asked for it", body)
        self.assertEqual(seen, [])
        status, _, _, seen = self.request("POST", "/api/reset-password/identity/finish")
        self.assertEqual((status, seen), (403, []))

    def test_the_browser_that_asked_reaches_the_reset(self):
        _, _, body, seen = self.request("GET", "/reset-password/step2?token=t", "jaia_reset=1")
        self.assertEqual(seen, [("GET", "/reset-password/step2?token=t")])
        _, _, _, seen = self.request("POST", "/api/reset-password/identity/finish", "jaia_reset=1")
        self.assertEqual(seen, [("POST", "/api/reset-password/identity/finish")])

    def test_a_scanner_cancels_nothing(self):
        for method, path in (("GET", "/revoke/one-time-code?id=i"), ("GET", "/revoke/reset-password?token=t"),
                             ("DELETE", "/api/user/session/elevation/i"), ("DELETE", "/api/reset-password")):
            status, _, _, seen = self.request(method, path)
            self.assertEqual((status, seen), (302, []), path)

    def test_someone_signed_in_can_cancel(self):
        for method, path in (("GET", "/revoke/one-time-code?id=i"), ("DELETE", "/api/user/session/elevation/i")):
            _, _, _, seen = self.request(method, path, "authelia_session=signed-in")
            self.assertEqual(seen, [(method, path)], path)

    def test_the_rest_of_the_portal_is_untouched(self):
        for method, path in (("GET", "/"), ("POST", "/api/firstfactor"), ("POST", "/api/reset-password"),
                             ("PUT", "/api/user/session/elevation")):
            _, _, _, seen = self.request(method, path)
            self.assertEqual(seen, [(method, path)], path)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


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
