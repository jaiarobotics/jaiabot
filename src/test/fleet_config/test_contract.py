#!/usr/bin/env python3

import copy
import importlib.util
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCRIPT = os.path.join(SOURCE_DIR, "scripts", "build", "fleet-config-contract.py")
PROTO = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto")
MESSAGES_DIR = os.path.join(SOURCE_DIR, "src", "lib", "messages")
TEMPLATES = os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates")
SNAPSHOT_DIR = os.path.join(MESSAGES_DIR, "fleet_config", "contract")

spec = importlib.util.spec_from_file_location("fleet_config_contract", SCRIPT)
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)

FLEET_CONFIG = "jaiabot.protobuf.FleetConfig"
NODE_SETTINGS = "jaiabot.protobuf.NodeSettings"


def declared_version():
    return contract.declared_version(PROTO)


def current():
    return contract.model_from_sources(PROTO, [MESSAGES_DIR], "protoc", TEMPLATES)


def run(args):
    return subprocess.run([sys.executable, SCRIPT] + args, capture_output=True, text=True)


class SnapshotTest(unittest.TestCase):
    def test_snapshot_matches_source_tree(self):
        version = declared_version()
        snapshot = contract.load_snapshot(SNAPSHOT_DIR, version, [MESSAGES_DIR], "protoc")
        self.assertEqual(snapshot, current(),
                         "contract/v{}/ is stale: see fleet-config-contract.py check".format(version))

    def test_snapshot_history_is_contiguous_and_never_removes(self):
        previous = None
        for v in range(1, declared_version() + 1):
            snapshot = contract.load_snapshot(SNAPSHOT_DIR, v, [MESSAGES_DIR], "protoc")
            self.assertEqual(snapshot["version"], v)
            if previous is not None:
                forbidden = [c for c in contract.diff(previous, snapshot) if c.kind == contract.FORBIDDEN]
                self.assertEqual(forbidden, [])
            previous = snapshot

    def test_v1_to_v2_is_the_typed_settings_migration(self):
        v1 = contract.load_snapshot(SNAPSHOT_DIR, 1, [MESSAGES_DIR], "protoc")
        v2 = contract.load_snapshot(SNAPSHOT_DIR, 2, [MESSAGES_DIR], "protoc")
        texts = [c.text for c in contract.diff(v1, v2)]
        self.assertIn("field jaiabot.protobuf.FleetConfig.debconf deprecated: migration must clear it", texts)
        self.assertIn("optional field jaiabot.protobuf.FleetConfig.settings added", texts)
        # every stored v1 question survives with the same type, choices and default; the
        # per-node ids became bounds-checked strings but are never in a fleet config
        identity = {k for k, v in v2["debconf"].items() if v.get("identity")}
        def stored(model):
            return {k: {a: v[a] for a in ("type", "choices", "default") if a in v}
                    for k, v in model["debconf"].items() if k not in identity}
        v2_stored = stored(v2)
        for key, entry in stored(v1).items():
            self.assertEqual(entry, v2_stored.get(key), key)
        for key in sorted(identity):
            if v1["debconf"][key]["type"] != v2["debconf"][key]["type"]:
                self.assertIn("debconf {} changed type from select to string".format(key), texts)

    def test_generated_view_marks_identity_and_replacements(self):
        debconf = current()["debconf"]
        self.assertTrue(debconf["jaiabot-embedded/type"]["identity"])
        self.assertNotIn("identity", debconf["jaiabot-embedded/bot_type"])
        self.assertEqual(debconf["jaiabot-embedded/bot_type"]["replaced"], {"echo": "pam"})
        self.assertEqual(debconf["jaiabot-embedded/arduino_type"]["replaced"], {"usb_old": "usb", "usb_new": "usb"})
        self.assertEqual(debconf["jaiabot-embedded/bot_type"]["choices"], ["hydro", "pam", "bio", "none"])


class ClassificationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = current()

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
        self.fields(new)["timezone"] = {"number": 14, "label": "optional", "type": "string"}
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_required_field_added_is_breaking(self):
        new = self.modified()
        self.fields(new)["timezone"] = {"number": 14, "label": "required", "type": "string"}
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_field_deprecated_is_breaking(self):
        new = self.modified()
        self.fields(new)["wlan_password"]["deprecated"] = True
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_fleet_config_default_change_is_breaking(self):
        new = self.modified()
        self.fields(new)["version"]["default"] = "3"
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_settings_default_change_is_compatible(self):
        new = self.modified()
        self.fields(new, NODE_SETTINGS)["imu_type"]["default"] = "IMU_TYPE_BNO085"
        new["debconf"]["jaiabot-embedded/imu_type"]["default"] = "bno085"
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_message_removed_is_forbidden(self):
        new = self.modified()
        del new["proto"]["messages"][FLEET_CONFIG + ".Communications"]
        self.assertIn(contract.FORBIDDEN, self.kinds(new))

    def test_enum_value_removed_is_forbidden(self):
        new = self.modified()
        del new["proto"]["enums"][NODE_SETTINGS + ".BotType"]["BOT_TYPE_BIO"]
        new["debconf"]["jaiabot-embedded/bot_type"]["choices"].remove("bio")
        self.assertIn(contract.FORBIDDEN, self.kinds(new))

    def test_enum_value_added_is_compatible(self):
        new = self.modified()
        new["proto"]["enums"][NODE_SETTINGS + ".BotType"]["BOT_TYPE_SONAR"] = {"number": 5}
        new["debconf"]["jaiabot-embedded/bot_type"]["choices"].append("sonar")
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_enum_value_deprecated_is_breaking(self):
        new = self.modified()
        new["proto"]["enums"][NODE_SETTINGS + ".BotType"]["BOT_TYPE_BIO"]["deprecated"] = True
        new["debconf"]["jaiabot-embedded/bot_type"]["choices"].remove("bio")
        new["debconf"]["jaiabot-embedded/bot_type"]["replaced"]["bio"] = "hydro"
        kinds = self.kinds(new)
        self.assertEqual(kinds, {contract.BREAKING})

    def test_debconf_question_removed_is_breaking(self):
        new = self.modified()
        del new["debconf"]["jaiabot-embedded/led_type"]
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_question_added_with_default_is_compatible(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/gps_type"] = {"type": "select", "choices": ["ublox", "none"], "default": "none"}
        self.assertEqual(self.kinds(new), {contract.COMPATIBLE})

    def test_debconf_question_added_without_default_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/gps_type"] = {"type": "select", "choices": ["ublox", "none"]}
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_debconf_type_change_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/bot_type"]["type"] = "multiselect"
        self.assertIn(contract.BREAKING, self.kinds(new))

    def test_identity_change_is_breaking(self):
        new = self.modified()
        new["debconf"]["jaiabot-embedded/warp"]["identity"] = True
        self.assertEqual(self.kinds(new), {contract.BREAKING})

    def test_worst_ranks_forbidden_over_breaking_over_compatible(self):
        changes = [contract.Change(contract.COMPATIBLE, ""), contract.Change(contract.BREAKING, "")]
        self.assertEqual(contract.worst(changes), contract.BREAKING)
        changes.append(contract.Change(contract.FORBIDDEN, ""))
        self.assertEqual(contract.worst(changes), contract.FORBIDDEN)


class TemplatesParserTest(unittest.TestCase):
    def test_v1_templates_parsed(self):
        with open(os.path.join(SNAPSHOT_DIR, "v1", "jaiabot-embedded.templates")) as f:
            debconf = contract.debconf_contract_from_templates(f.read())
        self.assertEqual(debconf["jaiabot-embedded/bot_type"],
                         {"type": "select", "choices": ["hydro", "pam", "bio", "none"], "default": "hydro"})
        self.assertEqual(debconf["jaiabot-embedded/rf_encryption_password"], {"type": "string", "default": ""})
        self.assertFalse(any("debconf_state_" in k for k in debconf))


class CheckCommandTest(unittest.TestCase):
    """Runs 'check' against a copy of the source tree with edited snapshots."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.snapshots = os.path.join(self.tmp, "contract")
        shutil.copytree(SNAPSHOT_DIR, self.snapshots)
        self.proto = os.path.join(self.tmp, "fleet_config.proto")
        shutil.copyfile(PROTO, self.proto)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def check(self):
        return run(["--proto", self.proto, "--templates", TEMPLATES, "-I", MESSAGES_DIR,
                    "--snapshot-dir", self.snapshots, "check"])

    def current_snapshot_proto(self):
        return os.path.join(self.snapshots, "v{}".format(declared_version()), "fleet_config.proto")

    def edit(self, path, old, new):
        with open(path) as f:
            text = f.read()
        self.assertIn(old, text)
        with open(path, "w") as f:
            f.write(text.replace(old, new))

    def test_passes_on_source_tree(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_fails_without_snapshot(self):
        shutil.rmtree(os.path.join(self.snapshots, "v{}".format(declared_version())))
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("No contract snapshot", result.stderr)

    def test_reports_breaking_change_with_bump_instructions(self):
        # a question added without a default
        self.edit(self.proto, "    optional int32 hub_id = 22",
                  '    optional string timezone = 30 [(jaia.field).debconf = { group: ALL description: "tz" }];\n    optional int32 hub_id = 22')
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("[breaking] debconf jaiabot-embedded/timezone added without a default", result.stderr)
        self.assertIn("increment (jaia.file).fleet_config_version", result.stderr)

    def test_reports_compatible_change_with_refresh_instructions(self):
        self.edit(self.proto, "    optional CloudHubAuth cloudhub_auth = 11;",
                  "    optional CloudHubAuth cloudhub_auth = 11;\n    optional string notes = 14;")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("[compatible] optional field jaiabot.protobuf.FleetConfig.notes added", result.stderr)
        self.assertIn("No version bump is needed", result.stderr)

    def test_reports_forbidden_removal(self):
        self.edit(self.proto, "    required bool service_vpn_enabled = 7;\n", "")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("[forbidden] field jaiabot.protobuf.FleetConfig.service_vpn_enabled (7) was removed", result.stderr)

    def test_rejects_snapshot_history_with_removal(self):
        # deleting a field and freezing a new snapshot is still caught
        self.edit(self.proto, "    required bool service_vpn_enabled = 7;\n", "")
        self.edit(self.proto, "fleet_config_version = {};".format(declared_version()),
                  "fleet_config_version = {};".format(declared_version() + 1))
        new_dir = os.path.join(self.snapshots, "v{}".format(declared_version() + 1))
        os.makedirs(new_dir)
        shutil.copyfile(self.proto, os.path.join(new_dir, "fleet_config.proto"))
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("not a valid successor", result.stderr)

    def test_rejects_gap_in_snapshot_history(self):
        shutil.rmtree(os.path.join(self.snapshots, "v1"))
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("v1/ is missing", result.stderr)

    def test_rejects_version_mismatch_in_snapshot(self):
        self.edit(self.current_snapshot_proto(), "fleet_config_version = {};".format(declared_version()),
                  "fleet_config_version = 9;")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("declares version 9", result.stderr)


if __name__ == "__main__":
    unittest.main()
