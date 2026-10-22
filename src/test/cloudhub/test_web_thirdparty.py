#!/usr/bin/env python3
"""A CloudHub's first boot takes Caddy, Authelia and LLDAP from jaiabot-web-thirdparty,
built by jaiabot's own deb pipeline, and nothing from a third party's server."""

import json
import pathlib
import re
import subprocess
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
THIRDPARTY = SOURCE_DIR / "src" / "web" / "thirdparty"
DEBIAN = SOURCE_DIR / "debian"
FIRST_BOOT_SCRIPTS = [
    SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_authelia.sh",
    SOURCE_DIR / "src" / "sh" / "system" / "jaia_configure_cloudhub.sh",
    SOURCE_DIR / "rootfs" / "customization" / "includes.chroot" / "etc" / "jaiabot" / "init"
    / "common-first-boot.yml",
]
THIRD_PARTY_HOSTS = ["caddyserver.com", "authelia.com", "awscli.amazonaws.com", "docker compose", "docker.io", "lldap/lldap:"]


def versions():
    pairs = {}
    for line in (THIRDPARTY / "versions.env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            pairs[key] = value
    return pairs


def control_stanza(package):
    stanzas = (DEBIAN / "control").read_text().split("\n\n")
    return next(s for s in stanzas if s.startswith(f"Package: {package}\n"))


class FirstBootTest(unittest.TestCase):
    def test_first_boot_fetches_nothing_from_third_parties(self):
        for script in FIRST_BOOT_SCRIPTS:
            text = script.read_text()
            for host in THIRD_PARTY_HOSTS:
                self.assertNotIn(host, text, f"{script.name} still reaches {host}")

    def test_configure_installs_the_package_without_upgrading_it(self):
        text = FIRST_BOOT_SCRIPTS[0].read_text()
        self.assertIn("apt-get install -y --no-upgrade jaiabot-web-thirdparty", text)
        self.assertNotIn("apt-get install -y authelia", text)

    def test_the_image_carries_the_package(self):
        packages = (SOURCE_DIR / "rootfs" / "customization" / "package-lists"
                    / "cloud.list.chroot").read_text().split()
        self.assertIn("jaiabot-web-thirdparty", packages)
        self.assertIn("python3-boto3", packages)

    def test_a_minor_upgrade_takes_the_newest_package(self):
        text = (SOURCE_DIR / "config" / "ansible" / "tasks" / "install-jaiabot.yml").read_text()
        upgrade = text.index("name: jaiabot-web-thirdparty")
        self.assertLess(upgrade, text.index("jaia_configure_authelia.sh"))
        self.assertIn("state: latest", text[upgrade:upgrade + 80])


class ConfigureScriptTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = FIRST_BOOT_SCRIPTS[0].read_text()

    def test_caddy_restarts_when_its_binary_was_replaced(self):
        self.assertIn('readlink "/proc/$caddy_pid/exe"', self.text)
        self.assertIn("if $caddy_binary_changed ||", self.text)
        self.assertIn("systemctl enable caddy", self.text)

    def test_lldap_runs_from_the_package(self):
        self.assertIn("/usr/libexec/lldap/bootstrap.sh", self.text)
        self.assertIn("LLDAP_SET_PASSWORD_PATH=/usr/bin/lldap_set_password", self.text)
        self.assertIn("systemctl enable lldap", self.text)
        config = re.search(r"cat <<EOF > /etc/lldap/lldap_config.toml\n(.*?)\nEOF", self.text,
                           re.DOTALL).group(1)
        for key in ("ldap_port", "http_port", "jwt_secret", "key_seed", "ldap_base_dn",
                    "ldap_user_dn", "ldap_user_pass", "database_url"):
            self.assertRegex(config, re.compile(rf"^{key} = ", re.MULTILINE),
                             f"{key} missing from lldap_config.toml")
        self.assertIn('database_url = "sqlite://$lldap_persistent_dir/users.db?mode=rwc"', config)

    def test_lldap_bootstrap_reads_the_same_directories_as_before(self):
        self.assertIn("USER_CONFIGS_DIR=/etc/lldap/bootstrap/user-configs", self.text)
        self.assertIn("GROUP_CONFIGS_DIR=/etc/lldap/bootstrap/group-configs", self.text)
        self.assertIn("DO_CLEANUP=false", self.text)

    def test_the_script_written_lldap_unit_gives_way_to_the_package_unit(self):
        self.assertIn("rm -f /etc/systemd/system/lldap.service", self.text)
        self.assertNotIn("cat <<EOF > /etc/systemd/system/lldap.service\n", self.text)


class PackageTest(unittest.TestCase):
    def test_control_stanza(self):
        stanza = control_stanza("jaiabot-web-thirdparty")
        self.assertIn("Architecture: any", stanza)
        for field in ("Provides", "Conflicts", "Replaces"):
            self.assertRegex(stanza, re.compile(rf"^{field}: caddy, authelia$", re.MULTILINE))
        depends = re.search(r"^Depends:(.*?)^\S", stanza + "\nX", re.MULTILINE | re.DOTALL).group(1)
        for package in ("awscli", "curl", "jq", "jo"):
            self.assertRegex(depends, rf"\b{package}\b")

    def test_build_depends_on_a_native_go_toolchain(self):
        source = (DEBIAN / "control").read_text().split("\n\n")[0]
        self.assertIn("golang-go:native (>= 2:1.26~)", source)

    def test_rules_build_caddy_offline_from_the_pinned_modules(self):
        rules = (DEBIAN / "rules").read_text()
        self.assertIn("export GOTOOLCHAIN = local", rules)
        self.assertIn("export GOFLAGS = -trimpath -mod=readonly", rules)
        self.assertIn("export CGO_ENABLED = 0", rules)
        self.assertIn("export GOARCH = $(DEB_HOST_ARCH)", rules)
        self.assertIn("grep -x http.handlers.replace_response", rules)
        self.assertIn("fetch.sh $(DEB_HOST_ARCH) $(THIRDPARTY_STAGE)", rules)
        self.assertIn("dh_installsystemd -pjaiabot-web-thirdparty --no-enable --no-start", rules)

    def test_install_file_covers_every_unit_and_binary(self):
        install = (DEBIAN / "jaiabot-web-thirdparty.install").read_text()
        self.assertIn("src/web/thirdparty/systemd/*.service usr/lib/systemd/system", install)
        self.assertIn("debian/thirdparty-build/stage/usr/bin/* usr/bin", install)
        self.assertIn("usr/libexec/lldap usr/libexec", install)
        self.assertIn("usr/share/lldap usr/share", install)

    def test_units_start_the_binaries_the_package_ships(self):
        binaries = {"caddy": "/usr/bin/caddy", "caddy-api": "/usr/bin/caddy",
                    "authelia": "/usr/bin/authelia", "lldap": "/usr/bin/lldap"}
        for unit, binary in binaries.items():
            text = (THIRDPARTY / "systemd" / f"{unit}.service").read_text()
            self.assertRegex(text, re.compile(rf"^ExecStart={binary} ", re.MULTILINE), unit)
            self.assertRegex(text, re.compile(rf"^User={unit.split('-')[0]}$", re.MULTILINE), unit)
            self.assertIn("WantedBy=multi-user.target", text)

    def test_postinst_creates_each_service_user(self):
        postinst = (DEBIAN / "jaiabot-web-thirdparty.postinst").read_text()
        for user in ("caddy", "authelia", "lldap"):
            self.assertRegex(postinst, rf"getent passwd {user} [^\n]*\n\s+adduser --system --group [\s\S]*? {user}\n")

    def test_preinst_clears_the_old_caddy_diversion(self):
        preinst = (DEBIAN / "jaiabot-web-thirdparty.preinst").read_text()
        self.assertIn("dpkg-divert --remove --no-rename /usr/bin/caddy", preinst)
        self.assertIn("update-alternatives --remove-all caddy", preinst)


class PinsTest(unittest.TestCase):
    def test_versions_env_pins_every_tarball(self):
        pins = versions()
        for key in ("AUTHELIA_VERSION", "LLDAP_VERSION"):
            self.assertRegex(pins[key], r"^\d+\.\d+\.\d+$", key)
        for key in ("AUTHELIA_SHA256_AMD64", "AUTHELIA_SHA256_ARM64", "LLDAP_SHA256_AMD64",
                    "LLDAP_SHA256_ARM64", "LLDAP_BOOTSTRAP_SHA256"):
            self.assertRegex(pins[key], r"^[0-9a-f]{64}$", key)

    def test_renovate_finds_each_version_line(self):
        config = json.loads((SOURCE_DIR / "renovate.json").read_text())
        manager = next(m for m in config["customManagers"] if m["customType"] == "regex")
        pattern = re.compile(manager["matchStrings"][0].replace("(?<", "(?P<"))
        found = {m.group("depName"): m.group("currentValue")
                 for m in pattern.finditer((THIRDPARTY / "versions.env").read_text())}
        pins = versions()
        self.assertEqual(found, {"authelia/authelia": pins["AUTHELIA_VERSION"],
                                 "lldap/lldap": pins["LLDAP_VERSION"]})
        common = (SOURCE_DIR / "scripts" / "common-versions.env").read_text()
        announced = {m.group("depName") for m in pattern.finditer(common)}
        self.assertEqual(announced, {"arduino/arduino-cli", "node", "nvm-sh/nvm", "npm", "webpack",
                                     "webpack-cli", "raspberrypi/firmware"})
        self.assertIn("/^scripts/common-versions\\.env$/", manager["managerFilePatterns"])
        self.assertIn("3.y", config["baseBranchPatterns"])
        self.assertEqual(config["gomod"]["managerFilePatterns"],
                         ["/^src/web/thirdparty/caddy/go\\.mod$/"])

    def test_go_module_pins_caddy_and_the_plugin(self):
        gomod = (THIRDPARTY / "caddy" / "go.mod").read_text()
        gosum = (THIRDPARTY / "caddy" / "go.sum").read_text()
        for module in ("github.com/caddyserver/caddy/v2", "github.com/caddyserver/replace-response"):
            version = re.search(rf"^\s*{re.escape(module)} (\S+)$", gomod, re.MULTILINE).group(1)
            self.assertIn(f"{module} {version} ", gosum)
        main = (THIRDPARTY / "caddy" / "main.go").read_text()
        self.assertIn('_ "github.com/caddyserver/caddy/v2/modules/standard"', main)
        self.assertIn('_ "github.com/caddyserver/replace-response"', main)

    def test_fetch_script_parses_and_refuses_unknown_arguments(self):
        subprocess.run(["bash", "-n", str(THIRDPARTY / "fetch.sh")], check=True)
        result = subprocess.run([str(THIRDPARTY / "fetch.sh"), "riscv64", "/nonexistent"],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("usage", result.stderr)


if __name__ == "__main__":
    unittest.main()
