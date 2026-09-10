#!/usr/bin/env python3

import copy
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCRIPT = os.path.join(SOURCE_DIR, "scripts", "build", "fleet-config-contract.py")
PROTO = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto")
TEMPLATES = os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates")
SNAPSHOT_DIR = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config", "contract")
VERSIONS_CMAKE = os.path.join(SOURCE_DIR, "cmake", "JaiaVersions.cmake")

spec = importlib.util.spec_from_file_location("fleet_config_contract", SCRIPT)
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)

FLEET_CONFIG = "jaiabot.protobuf.FleetConfig"


def configured_version():
    with open(VERSIONS_CMAKE) as f:
        match = re.search(r"set\(PROJECT_FLEET_CONFIG_VERSION\s+(\d+)\)", f.read())
    return int(match.group(1))


def cli(command, *extra):
    return [SCRIPT, command, "--proto", PROTO, "--templates", TEMPLATES] + list(extra)


def run(args):
    return subprocess.run([sys.executable] + args, capture_output=True, text=True)


def current():
    return json.loads(run(cli("generate", "--version", str(configured_version()))).stdout)


class SnapshotTest(unittest.TestCase):
    def test_snapshot_matches_source_tree(self):
        version = configured_version()
        with open(contract.snapshot_path(SNAPSHOT_DIR, version)) as f:
            snapshot = json.load(f)
        self.assertEqual(snapshot, current(),
                         "src/lib/messages/fleet_config/contract/v{}.json is stale: see fleet-config-contract.py check".format(version))

    def test_snapshot_history_is_contiguous_and_never_removes(self):
        version = configured_version()
        previous = None
        for v in range(1, version + 1):
            snapshot = contract.load_snapshot(SNAPSHOT_DIR, v)
            if previous is not None:
                forbidden = [c for c in contract.diff(previous, snapshot) if c.kind == contract.FORBIDDEN]
                self.assertEqual(forbidden, [])
            previous = snapshot


class ClassificationTest(unittest.TestCase):
    def setUp(self):
        self.base = current()

    def modified(self):
        return copy.deepcopy(self.base)

    def kinds(self, new):
        return {c.kind for c in contract.diff(self.base, new)}

    def fields(self, c, message=FLEET_CONFIG):
        return c["proto"]["messages"][message]["fields"]

    def test_identical(self):
        self.assertEqual(contract.diff(self.base, self.modified()), [])
        self.assertIsNone(contract.worst([]))

    def test_field_removed_is_forbidden(self):
        new = self.modified()
        del self.fields(new)["wlan_password"]
        self.assertEqual(self.kinds(new), {contract.FORBIDDEN})

    def test_field_renamed_is_forbidden(self):
        new = self.modified()
        self.fields(new)["wifi_password"] = self.fields(new).pop("wlan_password")
        self.assertIn(contract.FORBIDDEN, self.kinds(new))

    def test_field_number_change_is_forbidden(self):
        new = self.modified()
        self.fields(new)["fleet"]["number"] = 42
        self.assertEqual(self.kinds(new), {contract.FORBIDDEN})

    def test_field_label_change_is_forbidden(self):
        new = self.modified()
        self.fields(new)["fleet"]["label"] = "optional"
        self.assertEqual(self.kinds(new), {contract.FORBIDDEN})

    def test_optional_field_added_is_compatible(self):
        new = self.modified()
        self.fields(new)["timezone"] = {"number": 12, "label": "optional", "type": "string"}
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_required_field_added_is_breaking(self):
        new = self.modified()
        self.fields(new)["timezone"] = {"number": 12, "label": "required", "type": "string"}
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_field_deprecated_is_breaking(self):
        new = self.modified()
        self.fields(new)["wlan_password"]["deprecated"] = True
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_field_default_change_is_breaking(self):
        new = self.modified()
        self.fields(new)["version"]["default"] = "2"
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_message_removed_is_forbidden(self):
        new = self.modified()
        del new["proto"]["messages"][FLEET_CONFIG + ".Communications"]
        self.assertIn(contract.FORBIDDEN, self.kinds(new))

    def test_enum_value_removed_is_forbidden(self):
        new = self.modified()
        del new["proto"]["enums"][FLEET_CONFIG + ".Debconf.DebconfType"]["PASSWORD"]
        self.assertEqual(self.kinds(new), {contract.FORBIDDEN})

    def test_enum_value_added_is_compatible(self):
        new = self.modified()
        new["proto"]["enums"][FLEET_CONFIG + ".Debconf.DebconfType"]["ERROR"] = {"number": 7}
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_enum_value_deprecated_is_breaking(self):
        new = self.modified()
        new["proto"]["enums"][FLEET_CONFIG + ".Debconf.DebconfType"]["NOTE"]["deprecated"] = True
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_key_removed_is_breaking(self):
        new = self.modified()
        del new["debconf"]["jaiabot-embedded/led_type"]
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_key_added_with_default_is_compatible(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/gps_type"] = {"type": "select", "choices": ["ublox", "none"], "default": "none"}
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_debconf_key_added_without_default_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/gps_type"] = {"type": "select", "choices": ["ublox", "none"]}
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_choice_removed_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/bot_type"]["choices"].remove("bio")
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_choice_added_is_compatible(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/bot_type"]["choices"].append("sonar")
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_debconf_type_change_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/bot_type"]["type"] = "multiselect"
        self.assertIn(contract.BREAKING, self.kinds(new))

    def test_debconf_default_change_is_compatible(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/bot_type"]["default"] = "pam"
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_worst_ranks_forbidden_over_breaking_over_compatible(self):
        changes = [contract.Change(contract.COMPATIBLE, ""), contract.Change(contract.BREAKING, "")]
        self.assertEqual(contract.worst(changes), contract.BREAKING)
        changes.append(contract.Change(contract.FORBIDDEN, ""))
        self.assertEqual(contract.worst(changes), contract.FORBIDDEN)


class TemplatesTest(unittest.TestCase):
    def test_templates_parsed(self):
        debconf = current()["debconf"]
        self.assertEqual(debconf["jaiabot-embedded/bot_type"],
                         {"type": "select", "choices": ["hydro", "pam", "bio", "none"], "default": "hydro"})
        self.assertEqual(debconf["jaiabot-embedded/rf_encryption_password"], {"type": "string", "default": ""})
        self.assertNotIn("jaiabot-embedded/type", {k for k in debconf if k.endswith("debconf_state_common")})
        self.assertFalse(any("debconf_state_" in k for k in debconf))

    def test_version_field_present(self):
        fields = current()["proto"]["messages"][FLEET_CONFIG]["fields"]
        self.assertEqual(fields["version"], {"number": 10, "label": "optional", "type": "uint32", "default": "1"})


class CheckCommandTest(unittest.TestCase):
    def check(self, snapshot_dir, version):
        return run(cli("check", "--version", str(version), "--snapshot-dir", snapshot_dir))

    def write(self, snapshot_dir, version, c):
        with open(contract.snapshot_path(snapshot_dir, version), "w") as f:
            f.write(contract.dump(c))

    def test_passes_against_matching_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, 1, current())
            result = self.check(tmp, 1)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_fails_without_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = self.check(tmp, 1)
            self.assertEqual(result.returncode, 1)
            self.assertIn("No contract snapshot", result.stderr)

    def test_reports_breaking_change_with_bump_instructions(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = current()
            del old["debconf"]["jaiabot-embedded/led_type"]  # i.e. the templates gained led_type since
            old["debconf"]["jaiabot-embedded/legacy"] = {"type": "select", "choices": ["a"], "default": "a"}
            self.write(tmp, 1, old)
            result = self.check(tmp, 1)
            self.assertEqual(result.returncode, 1)
            self.assertIn("[breaking] debconf jaiabot-embedded/legacy removed", result.stderr)
            self.assertIn("increment PROJECT_FLEET_CONFIG_VERSION", result.stderr)

    def test_reports_compatible_change_with_refresh_instructions(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = current()
            del old["debconf"]["jaiabot-embedded/led_type"]
            self.write(tmp, 1, old)
            result = self.check(tmp, 1)
            self.assertEqual(result.returncode, 1)
            self.assertIn("[compatible] debconf jaiabot-embedded/led_type added", result.stderr)
            self.assertIn("No version bump is needed", result.stderr)

    def test_reports_forbidden_removal(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = current()
            old["proto"]["messages"][FLEET_CONFIG]["fields"]["retired"] = {"number": 99, "label": "optional", "type": "string"}
            self.write(tmp, 1, old)
            result = self.check(tmp, 1)
            self.assertEqual(result.returncode, 1)
            self.assertIn("[forbidden] field jaiabot.protobuf.FleetConfig.retired (99) was removed", result.stderr)

    def test_rejects_snapshot_history_with_removal(self):
        with tempfile.TemporaryDirectory() as tmp:
            v1 = current()
            v1["proto"]["messages"][FLEET_CONFIG]["fields"]["retired"] = {"number": 99, "label": "optional", "type": "string"}
            self.write(tmp, 1, v1)
            v2 = current()
            v2["version"] = 2
            self.write(tmp, 2, v2)
            result = self.check(tmp, 2)
            self.assertEqual(result.returncode, 1)
            self.assertIn("not a valid successor", result.stderr)

    def test_rejects_gap_in_snapshot_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            v2 = current()
            v2["version"] = 2
            self.write(tmp, 2, v2)
            result = self.check(tmp, 2)
            self.assertEqual(result.returncode, 1)
            self.assertIn("v1.json is missing", result.stderr)


if __name__ == "__main__":
    unittest.main()
