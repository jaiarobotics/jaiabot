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


class GeneratedFilesTest(unittest.TestCase):
    def test_committed_files_are_current(self):
        result = subprocess.run([sys.executable, GEN, "--check"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_generated_templates_match_the_hand_written_v1_file(self):
        """Same questions, types, choices and defaults as before they were generated."""
        with open(os.path.join(SNAPSHOT_DIR, "v1", "jaiabot-embedded.templates")) as f:
            v1 = contract.debconf_contract_from_templates(f.read())
        with open(os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates")) as f:
            now = contract.debconf_contract_from_templates(f.read())
        self.assertEqual(v1, now)

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


if __name__ == "__main__":
    unittest.main()
