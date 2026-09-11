#!/usr/bin/env python3

import importlib.util
import os
import subprocess
import sys
import unittest

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
GEN = os.path.join(SOURCE_DIR, "scripts", "build", "fleet-config-debconf-gen.py")
CONTRACT = os.path.join(SOURCE_DIR, "scripts", "build", "fleet-config-contract.py")
SNAPSHOT_DIR = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config", "contract")


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = load(GEN, "fleet_config_debconf_gen")
contract = load(CONTRACT, "fleet_config_contract")
CURRENT = contract.debconf_contract_from_schema(
    gen.fc.Schema(gen.fc.compile_descriptor_set(
        os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto"),
        [os.path.join(SOURCE_DIR, "src", "lib", "messages")])))


class GeneratedFilesTest(unittest.TestCase):
    def test_committed_files_are_current(self):
        result = subprocess.run([sys.executable, GEN, "--check"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_generated_templates_keep_every_hand_written_v1_question(self):
        """Every question of the hand-written file survives with the same type,
        choices and default. Later releases may add questions; the ids became
        strings checked against jaia_bounds."""
        with open(os.path.join(SNAPSHOT_DIR, "v1", "jaiabot-embedded.templates")) as f:
            v1 = contract.debconf_contract_from_templates(f.read())
        with open(os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates")) as f:
            now = contract.debconf_contract_from_templates(f.read())
        ids = {"jaiabot-embedded/" + name for name in ("fleet_id", "bot_id", "hub_id")}
        for key, entry in v1.items():
            if key in ids:
                continue
            current = now.get(key)
            self.assertIsNotNone(current, key)
            self.assertEqual(entry["type"], current["type"], key)
            # a choice may only disappear by being retired in the schema
            for choice in entry.get("choices", []):
                if choice not in current.get("choices", []):
                    self.assertIn(choice, CURRENT[key].get("deprecated", []), key + "/" + choice)
        for key in ids:
            self.assertEqual(now[key], {"type": "string", "default": "0"})

    def test_generated_templates_carry_an_error_for_each_id(self):
        with open(os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates")) as f:
            templates = f.read()
        for name in ("fleet_id", "bot_id", "hub_id"):
            self.assertIn("Template: jaiabot-embedded/{}_invalid\nType: error\n".format(name), templates)

    def test_no_question_interrupts_an_interactive_upgrade(self):
        """debconf's default threshold is "high", so a question asked below it is
        skipped and keeps its default when a release adds one; dpkg-reconfigure
        lowers the threshold and asks every question regardless."""
        with open(os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.config")) as f:
            config = f.read()
        self.assertNotIn("debconf_input_and_go high", config)

    def test_generated_config_is_valid_shell(self):
        result = subprocess.run(["sh", "-n", os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.config")],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_generated_config_carries_the_flow_rules(self):
        with open(os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.config")) as f:
            config = f.read()
        self.assertIn("echo) db_set jaiabot-embedded/bot_type pam ;;", config)
        self.assertIn("none) db_set jaiabot-embedded/bot_type hydro ;;", config)
        self.assertIn("usb_old) db_set jaiabot-embedded/arduino_type usb ;;", config)
        # hubs never answer bot_type
        self.assertIn("configure_hub() {\n    local state=\"hub_id\"\n    db_set jaiabot-embedded/bot_type none", config)
        # warp only in simulation, pam connection only for pam bots
        self.assertIn('db_get jaiabot-embedded/mode\n                if [ "$RET" = "simulation" ]; then', config)
        self.assertIn("db_set jaiabot-embedded/pam_connection_type none", config)
        self.assertNotIn("camera_positions aft", config)
        # ids are re-asked until they pass the bounds check
        for name in ("fleet_id", "bot_id", "hub_id"):
            self.assertIn("if id_is_valid {}; then".format(name), config)
            self.assertIn("db_input critical jaiabot-embedded/{}_invalid || true".format(name), config)


if __name__ == "__main__":
    unittest.main()
