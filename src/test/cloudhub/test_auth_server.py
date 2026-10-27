#!/usr/bin/env python3
"""The auth.cloud.jaia.tech server's configure.sh: what it writes for Authelia, LLDAP and Caddy.

The access rules carry over from the server it replaces, and the sign-in page is a CloudHub's,
from the setup the two share. The files are rendered by running the script's own functions;
where caddy and authelia are installed, they are validated and the auth site is run.
"""

import http.server
import os
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
COMMON = SOURCE_DIR / "src" / "sh" / "system" / "jaia-authelia-common.sh"

BASE = "cloud.example.test"
ENV = {
    "AWS_REGION": "us-west-2",
    "AUTH_BASE_DOMAIN": BASE,
    "CADDY_ACME_CA": "",
    "AUTH_SMTP_ADDRESS": "submission://smtp.postmarkapp.com:587",
    "AUTH_SMTP_SENDER": "noreply@auth.jaia.tech",
    "AUTH_SMTP_CREDENTIALS_PARAMETER": "arn:aws:ssm:us-east-1:123456789012:parameter/jaia/cloudhub/smtp_credentials",
    "CC_DB_UPSTREAM": "172.31.24.45:80",
    "DATA_UPSTREAM": "172.31.24.227:80",
}
# What load_secrets and load_smtp_credentials would have set
LOADED = {
    "jwt_secret": "a" * 64,
    "session_secret": "b" * 64,
    "storage_encryption_key": "c" * 64,
    "lldap_jwt_secret": "e" * 64,
    "lldap_key_seed": "f" * 64,
    "authelia_ldap_password": "d" * 64,
    "smtp_username_line": "username: 'postmark-token'",
}


def render(function, **overrides):
    """What one of configure.sh's functions prints, run as the script would run it."""
    with tempfile.TemporaryDirectory() as tmp:
        env_file = pathlib.Path(tmp) / "auth-server.env"
        env_file.write_text("".join("%s=%s\n" % kv for kv in dict(ENV, **overrides).items()))
        assignments = "".join("%s=%s\n" % (k, shell_quote(v)) for k, v in LOADED.items())
        result = subprocess.run(
            # Not as $0, which would make the script run main
            ["bash", "-c", 'source "$1"\n%s%s' % (assignments, function), "bash", str(CONFIGURE)],
            env=dict(os.environ, AUTH_SERVER_ENV=str(env_file), JAIA_AUTHELIA_COMMON=str(COMMON)),
            capture_output=True, text=True)
    if result.returncode != 0:
        raise AssertionError("%s failed: %s" % (function, result.stderr))
    return result.stdout


def shell_quote(value):
    return "'%s'" % value.replace("'", "'\\''")


def block(text, opening):
    start = text.index(opening)
    return text[start:text.index("\n}\n", start) + 2]


def authelia_config():
    return render("authelia_config")


def caddyfile(**overrides):
    return render("caddyfile", **overrides)


class AccessTest(unittest.TestCase):
    """The sites and who reaches them, as on the server this replaces, less what was retired."""

    @unittest.skipUnless(yaml, "python3-yaml is not installed")
    def test_each_site_admits_its_group_with_two_factors(self):
        rules = yaml.safe_load(authelia_config())["access_control"]["rules"]
        for site, group in (("lldap", "lldap_admin"), ("cc", "cc_db"), ("sandbox.cc", "cc_db"),
                            ("launchpad", "cc_db"), ("data", "data")):
            domain = "%s.%s" % (site, BASE)
            # Authelia takes the first rule that matches; a whole-site request has no resource
            rule = next(r for r in rules if "resources" not in r and
                        domain in (r["domain"] if isinstance(r["domain"], list) else [r["domain"]]))
            self.assertEqual((rule["subject"], rule["policy"]), ("group:%s" % group, "two_factor"), site)

    @unittest.skipUnless(yaml, "python3-yaml is not installed")
    def test_test_runners_post_results_without_signing_in(self):
        rules = yaml.safe_load(authelia_config())["access_control"]["rules"]
        bypass = [i for i, r in enumerate(rules) if r["policy"] == "bypass"]
        self.assertEqual(len(bypass), 1)
        self.assertEqual(rules[bypass[0]]["domain"], "cc.%s" % BASE)
        self.assertEqual(rules[bypass[0]]["resources"], ["^/test-results/api/submit/$"])
        cc_db = next(i for i, r in enumerate(rules) if r.get("subject") == "group:cc_db")
        self.assertLess(bypass[0], cc_db, "the bypass must come before the cc_db rule, or it never applies")

    def test_each_upstream_is_proxied_only_after_a_sign_in(self):
        text = caddyfile()
        for sites, upstream in (("cc.%s, sandbox.cc.%s, launchpad.%s" % (BASE, BASE, BASE), "172.31.24.45:80"),
                                ("data.%s" % BASE, "172.31.24.227:80")):
            site = block(text, sites + " {")
            self.assertLess(site.index("import authelia_forward_auth"), site.index("reverse_proxy " + upstream))

    def test_everything_else_is_denied(self):
        self.assertIn("default_policy: 'deny'", authelia_config())

    def test_retired_sites_are_gone(self):
        text = CONFIGURE.read_text()
        self.assertNotIn("test.$base_uri", text)
        self.assertNotIn("domain_regex", text)
        self.assertNotIn("f1.", text)
        self.assertNotIn("wg_jaia_ch1", text)
        self.assertNotIn("wireguard", text.lower(), "cc_db and data are reached in the VPC")

    def test_authelia_binds_as_the_lldap_admin_as_on_a_cloudhub(self):
        self.assertIn("user: 'UID=authelia,OU=people,DC=jaia,DC=tech'", authelia_config())
        lldap = render("lldap_config")
        self.assertIn('ldap_user_dn = "authelia"', lldap)
        self.assertIn('ldap_user_pass = "%s"' % LOADED["authelia_ldap_password"], lldap)
        self.assertIn('http_url = "https://lldap.%s"' % BASE, lldap)
        # a migrated directory has admins already, so LLDAP leaves the account to bootstrap
        account = CONFIGURE.read_text()
        account = account[account.index('"id": "authelia"'):]
        self.assertIn('"groups": ["lldap_admin"]', account[:account.index("}")])

    def test_passkeys_still_need_a_password(self):
        self.assertIn("enable_passkey_login: false", authelia_config())

    def test_the_session_cookie_is_scoped_to_the_sites(self):
        self.assertIn("    - domain: '%s'\n      authelia_url: 'https://auth.%s'" % (BASE, BASE),
                      authelia_config())

    def test_mail_goes_through_postmark_with_credentials(self):
        text = authelia_config()
        self.assertIn("username: 'postmark-token'", text)
        self.assertIn("disable_startup_check: false", text)
        self.assertIn("address: 'submission://smtp.postmarkapp.com:587'", text)
        self.assertIn("load_postmark_credentials\n", CONFIGURE.read_text())


class SharedWithCloudHubTest(unittest.TestCase):
    """The sign-in page comes from the setup a CloudHub uses, so its protections are a CloudHub's."""

    def test_the_cancel_paths_need_one_factor(self):
        text = authelia_config()
        rules = text[text.index("  rules: # order matters!"):]
        first = rules[:rules.index("\n\n")]
        self.assertIn("- domain: auth.%s" % BASE, first)
        self.assertIn("policy: one_factor", first)

    def test_the_auth_site_is_the_shared_portal(self):
        site = block(caddyfile(), "auth.%s {" % BASE)
        self.assertIn("import authelia_portal authelia_proxy", site)
        self.assertIn(cloudhub.portal().replace("$jaia_cloud_web_dir", "/usr/local/share/jaia-auth-server/web"),
                      caddyfile())

    def test_the_static_pages_the_reset_page_needs_are_deployed(self):
        deploy = DEPLOY.read_text()
        page = (cloudhub.WEB / "reset-elsewhere.html").read_text()
        for ref in re.findall(r'(?:href|src)="/_jaia/([^"]+)"', page):
            if ref.startswith("nav."):
                continue  # the CloudHub's site menu; this server has none
            self.assertIn('"$WEB/%s"' % ref, deploy)
        self.assertIn('"$WEB/reset-elsewhere.html"', deploy)

    def test_the_shared_setup_is_deployed_where_configure_reads_it(self):
        self.assertIn('cp "$HERE/configure.sh" "$COMMON"', DEPLOY.read_text())
        self.assertIn("/usr/local/share/jaia-auth-server/jaia-authelia-common.sh", DEPLOY.read_text())
        self.assertIn("share_dir=/usr/local/share/jaia-auth-server", CONFIGURE.read_text())


@unittest.skipUnless(shutil.which("authelia"), "authelia is not installed")
class AutheliaValidateTest(unittest.TestCase):
    def test_authelia_accepts_the_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = pathlib.Path(tmp) / "configuration.yml"
            config.write_text(authelia_config().replace("/var/lib/authelia/", tmp + "/"))
            result = subprocess.run(["authelia", "validate-config", "--config", str(config)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


@unittest.skipUnless(shutil.which("caddy"), "caddy is not installed")
class CaddyValidateTest(unittest.TestCase):
    def validate(self, acme_ca):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "Caddyfile"
            path.write_text(caddyfile(CADDY_ACME_CA=acme_ca))
            result = subprocess.run(["caddy", "validate", "--config", str(path), "--adapter", "caddyfile"],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr[-2000:])

    def test_caddy_accepts_the_caddyfile(self):
        self.validate("")

    def test_caddy_accepts_it_with_the_staging_ca(self):
        self.validate("https://acme-staging-v02.api.letsencrypt.org/directory")


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
        site = block(text, "auth.%s {" % BASE).replace("auth.%s {" % BASE, "http://127.0.0.1:%d {" % cls.port, 1)
        caddy = "{\n        admin off\n}\n" + "\n".join(
            block(text, "(%s) {" % n) for n in ("authelia_forward_auth", "authelia_portal", "authelia_proxy",
                                                "jaia_static")) + "\n" + site
        caddy = caddy.replace("localhost:9091", "localhost:%d" % stub_port).replace(
            "/usr/local/share/jaia-auth-server/web", str(web))
        path = pathlib.Path(cls.tmp.name) / "Caddyfile"
        path.write_text(caddy)
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
