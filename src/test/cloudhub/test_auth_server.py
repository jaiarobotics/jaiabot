#!/usr/bin/env python3
"""The auth.cloud.jaia.tech server's configure.sh: what it writes for Authelia and Caddy.

The access rules carry over from the server it replaces, and the auth site keeps reset and
cancel links out of a mail scanner's reach the way a CloudHub's does. Where caddy and
authelia are installed, the files it writes are validated and the auth site is run.
"""

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

try:
    import yaml
except ImportError:
    yaml = None

import test_scanner_safe_links as cloudhub

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
AUTH_SERVER = SOURCE_DIR / "rootfs" / "cloud" / "aws" / "authelia"
CONFIGURE = AUTH_SERVER / "configure.sh"
DEPLOY = AUTH_SERVER / "deploy.sh"

VALUES = {
    "base": "cloud.example.test",
    "authelia_port": "9091",
    "lldap_ldap_port": "3890",
    "lldap_web_port": "17170",
    "web_dir": "/usr/local/share/jaia-auth-server/web",
    "authelia_dir": "/var/lib/authelia",
    "jwt_secret": "a" * 64,
    "session_secret": "b" * 64,
    "storage_encryption_key": "c" * 64,
    "authelia_ldap_password": "d" * 64,
    "smtp_username": "postmark-token",
    "AUTH_SMTP_ADDRESS": "submission://smtp.postmarkapp.com:587",
    "AUTH_SMTP_SENDER": "noreply@auth.jaia.tech",
    "CC_DB_WG_ADDRESS": "fd63:7ac0:9603::2",
    "DATA_WG_ADDRESS": "fd63:7ac0:9603::3",
    "acme_ca": "",
}


def heredoc(path):
    text = CONFIGURE.read_text()
    start = text.index("cat <<EOF > %s\n" % path)
    start = text.index("\n", start) + 1
    return text[start:text.index("\nEOF\n", start) + 1]


def render(template, **overrides):
    """As bash would expand it; a variable the test does not know fails the test."""
    values = dict(VALUES, **overrides)
    return re.sub(r"\$(\w+)", lambda m: values[m.group(1)], template)


def block(text, opening):
    start = text.index(opening)
    return text[start:text.index("\n}\n", start) + 2]


def authelia_config():
    return heredoc("/etc/authelia/configuration.yml")


def caddyfile():
    return heredoc("/etc/caddy/Caddyfile")


class AccessTest(unittest.TestCase):
    """The sites and who reaches them, as on the server this replaces, less what was retired."""

    def rules(self):
        text = authelia_config()
        return text[text.index("  rules: # order matters!"):text.index("\nsession:")]

    @unittest.skipUnless(yaml, "python3-yaml is not installed")
    def test_each_site_admits_its_group_with_two_factors(self):
        rules = yaml.safe_load(render(authelia_config()))["access_control"]["rules"]
        for site, group in (("lldap", "lldap_admin"), ("cc", "cc_db"), ("sandbox.cc", "cc_db"),
                            ("launchpad", "cc_db"), ("data", "data")):
            domain = "%s.%s" % (site, VALUES["base"])
            # Authelia takes the first rule that matches; a whole-site request has no resource
            rule = next(r for r in rules if "resources" not in r and
                        domain in (r["domain"] if isinstance(r["domain"], list) else [r["domain"]]))
            self.assertEqual((rule["subject"], rule["policy"]), ("group:%s" % group, "two_factor"), site)

    def test_test_runners_post_results_without_signing_in(self):
        rules = self.rules()
        bypass = rules[rules.index("- domain: cc.$base\n"):]
        bypass = bypass[:bypass.index("\n\n")]
        self.assertIn("'^/test-results/api/submit/$'", bypass)
        self.assertIn("policy: bypass", bypass)
        self.assertLess(rules.index("policy: bypass"), rules.index("subject: 'group:cc_db'"),
                        "the bypass must come before the cc_db rule, or it never applies")

    def test_everything_else_is_denied(self):
        self.assertIn("default_policy: 'deny'", authelia_config())

    def test_retired_sites_are_gone(self):
        text = CONFIGURE.read_text()
        self.assertNotIn("test.$base", text)
        self.assertNotIn("domain_regex", text)
        self.assertNotIn("f1.", text)
        self.assertNotIn("wg_jaia_ch1", text)

    def test_authelia_binds_as_its_own_account_not_admin(self):
        text = authelia_config()
        self.assertIn("user: 'UID=authelia,OU=people,DC=jaia,DC=tech'", text)
        self.assertNotIn("UID=admin", text)
        account = CONFIGURE.read_text()
        account = account[account.index('"id": "authelia"'):]
        self.assertIn('"groups": ["lldap_password_manager"]', account[:account.index("}")])

    def test_passkeys_still_need_a_password(self):
        self.assertRegex(authelia_config(), r"enable_passkey_login: false")

    def test_the_session_cookie_is_scoped_to_the_sites(self):
        self.assertIn("    - domain: '$base'\n      authelia_url: 'https://auth.$base'", authelia_config())

    def test_mail_goes_through_postmark_with_credentials(self):
        text = authelia_config()
        self.assertIn("username: '$smtp_username'", text)
        self.assertIn("disable_startup_check: false", text)
        self.assertIn("AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE", CONFIGURE.read_text())


class ScannerSafeTest(unittest.TestCase):
    """The same protections as a CloudHub's auth site (see test_scanner_safe_links)."""

    def test_the_cancel_paths_need_one_factor(self):
        text = authelia_config()
        rules = text[text.index("  rules: # order matters!"):]
        first = rules[:rules.index("\n\n")]
        self.assertIn("- domain: auth.$base", first)
        self.assertIn("policy: one_factor", first)
        patterns = re.findall(r"- '(\^[^']+)'", first)
        for path in ("/revoke/one-time-code", "/api/reset-password", "/api/user/session/elevation/abc"):
            self.assertTrue(any(re.match(p, path) for p in patterns), path)
        self.assertFalse(any(re.match(p, "/api/reset-password/identity/start") for p in patterns))

    def test_rate_limits_match_a_cloudhubs(self):
        def limits(text):
            return text[text.index("    rate_limits:"):text.index("\n# ", text.index("    rate_limits:"))]
        self.assertEqual(limits(authelia_config()), limits(cloudhub.CONFIGURE.read_text()))

    def test_cancel_links_and_calls_need_a_sign_in(self):
        site = block(caddyfile(), "auth.$base {")
        for name in ("cancel_link", "cancel_call"):
            handler = cloudhub.handle(site, name)
            self.assertLess(handler.index("import authelia_forward_auth"), handler.index("import authelia_proxy"))

    def test_denials_do_not_replace_a_sign_in(self):
        self.assertIn("header_down -Set-Cookie", block(caddyfile(), "(authelia_forward_auth) {"))

    def test_the_static_pages_the_reset_page_needs_are_deployed(self):
        deploy = DEPLOY.read_text()
        page = (cloudhub.WEB / "reset-elsewhere.html").read_text()
        for ref in re.findall(r'(?:href|src)="/_jaia/([^"]+)"', page):
            if ref.startswith("nav."):
                continue  # the CloudHub's site menu; this server has none
            self.assertIn('"$WEB/%s"' % ref, deploy)
        self.assertIn('"$WEB/reset-elsewhere.html"', deploy)


@unittest.skipUnless(shutil.which("authelia"), "authelia is not installed")
class AutheliaValidateTest(unittest.TestCase):
    def test_authelia_accepts_the_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = pathlib.Path(tmp) / "configuration.yml"
            config.write_text(render(authelia_config(), authelia_dir=tmp))
            result = subprocess.run(["authelia", "validate-config", "--config", str(config)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


@unittest.skipUnless(shutil.which("caddy"), "caddy is not installed")
class CaddyValidateTest(unittest.TestCase):
    def validate(self, acme_ca):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "Caddyfile"
            path.write_text(render(caddyfile(), acme_ca=acme_ca))
            result = subprocess.run(["caddy", "validate", "--config", str(path), "--adapter", "caddyfile"],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])

    def test_caddy_accepts_the_caddyfile(self):
        self.validate("")

    def test_caddy_accepts_it_with_the_staging_ca(self):
        self.validate("acme_ca https://acme-staging-v02.api.letsencrypt.org/directory")


@unittest.skipUnless(shutil.which("caddy"), "caddy is not installed")
class CaddyBehaviourTest(cloudhub.CaddyBehaviourTest):
    """The CloudHub's behaviour tests, run against this server's auth site."""

    @classmethod
    def setUpClass(cls):
        stub_port, cls.port = cloudhub.free_port(), cloudhub.free_port()
        cls.stub = http.server.ThreadingHTTPServer(("127.0.0.1", stub_port), cloudhub.StubAuthelia)
        threading.Thread(target=cls.stub.serve_forever, daemon=True).start()
        cls.tmp = tempfile.TemporaryDirectory()
        web = pathlib.Path(cls.tmp.name) / "web"
        shutil.copytree(cloudhub.WEB, web / "_jaia")
        text = caddyfile()
        site = block(text, "auth.$base {").replace("auth.$base {", "http://127.0.0.1:%d {" % cls.port, 1)
        caddy = "{\n        admin off\n}\n" + "\n".join(
            block(text, "(%s) {" % n) for n in ("authelia_forward_auth", "authelia_proxy", "jaia_static")) + "\n" + site
        path = pathlib.Path(cls.tmp.name) / "Caddyfile"
        path.write_text(render(caddy, authelia_port=str(stub_port), web_dir=str(web)))
        cls.caddy = subprocess.Popen(["caddy", "run", "--config", str(path), "--adapter", "caddyfile"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", cls.port), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)


if __name__ == "__main__":
    unittest.main()
