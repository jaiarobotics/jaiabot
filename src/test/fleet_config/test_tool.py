#!/usr/bin/env python3

import importlib.util
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
TOOL = os.path.join(SOURCE_DIR, "src", "sh", "fleet", "jaia-fleet-config.py")
PROTO = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto")
MESSAGES_DIR = os.path.join(SOURCE_DIR, "src", "lib", "messages")
TEMPLATE = os.path.join(SOURCE_DIR, "rootfs", "customization", "includes.chroot", "etc", "jaiabot", "init", "first-boot.preseed.yml.j2")
NEW_HUB_TEMPLATE = os.path.join(SOURCE_DIR, "config", "ansible", "files", "new_hub.sh.j2")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

spec = importlib.util.spec_from_file_location("jaia_fleet_config", TOOL)
fc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fc)

DESCRIPTOR_SET = fc.compile_descriptor_set(PROTO, [MESSAGES_DIR])
SCHEMA = fc.Schema(DESCRIPTOR_SET)

try:
    import jinja2
    import yaml
    HAVE_RENDER_DEPS = True
except ImportError:
    HAVE_RENDER_DEPS = False
needs_render_deps = unittest.skipUnless(HAVE_RENDER_DEPS, "python3-jinja2 and python3-yaml are needed to render first boot files")


def fixture(name):
    return os.path.join(FIXTURES, name)


class Env:
    """Temp dir with the descriptor set next to a copy of the tool (the boot
    tarball layout) and a fake jaia_ip on PATH."""

    def __init__(self):
        self.dir = tempfile.mkdtemp()
        self.tool = os.path.join(self.dir, "jaia-fleet-config.py")
        shutil.copyfile(TOOL, self.tool)
        os.chmod(self.tool, 0o755)
        with open(os.path.join(self.dir, fc.DESCRIPTOR_SET_NAME), "wb") as f:
            f.write(DESCRIPTOR_SET)
        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        fakes = {
            "jaia_ip": 'case "$*" in *gateway*) echo 10.23.7.1 ;; *cloudhub_vpn*) echo fd0f:77ac:4fdf:7::1:1e ;; *) echo 10.23.7.100 ;; esac',
            "jaia_bounds": 'case "$*" in *--min*) echo 0 ;; *fleet_id*) echo 4000 ;; *hub_id*) echo 30 ;; *bot_id*) echo 150 ;; esac',
            "ykman": "echo 12345678",
            # writes the key files ssh-keygen would, without a real key or Yubikey
            "ssh-keygen": 'while [ $# -gt 0 ]; do case "$1" in -f) shift; f="$1" ;; -C) shift; c="$1" ;; -t) shift; t="$1" ;; esac; shift; done\n'
                          'printf "PRIVATE %s\\n" "$c" > "$f"; printf "ssh-%s AAAA%s %s\\n" "$t" "$c" "$c" > "$f.pub"',
        }
        for name, body in fakes.items():
            with open(os.path.join(fake_bin, name), "w") as f:
                f.write("#!/bin/sh\n" + body + "\n")
            os.chmod(os.path.join(fake_bin, name), 0o755)
        self.env = dict(os.environ, PATH=fake_bin + os.pathsep + os.environ["PATH"])

    def run(self, *args):
        return subprocess.run([sys.executable, self.tool] + list(args), capture_output=True, text=True, env=self.env)

    def bootdir(self):
        bootdir = os.path.join(self.dir, "boot")
        init = os.path.join(bootdir, "jaiabot", "init")
        os.makedirs(init)
        shutil.copyfile(TEMPLATE, os.path.join(init, "first-boot.preseed.yml.j2"))
        shutil.copyfile(NEW_HUB_TEMPLATE, os.path.join(bootdir, "new_hub.sh.j2"))
        return bootdir

    def without_cloudhub_key(self):
        """A copy of v2_no_permanent_keys.cfg (fleet 6, hubs 1 and 30) as create now writes it,
        before create_cloudhub has recorded the CloudHub's key."""
        path = os.path.join(self.dir, "fleet6.cfg")
        with open(fixture("v2_no_permanent_keys.cfg")) as f:
            lines = [line for line in f if "hub { id: 30" not in line]
        text = "".join(lines).replace("hubs: 30", "hubs: [1, 30]").replace(
            "ssh {\n", 'ssh {\n  hub { id: 1 private_key: "handle\\n" public_key: "no-touch-required '
                       'sk-ssh-ed25519@openssh.com AAAAhub1 hub1_fleet6" }\n')
        with open(path, "w") as f:
            f.write(text)
        return path

    def pubkey_file(self, text):
        path = os.path.join(self.dir, "hub30_fleet6.pub")
        with open(path, "w") as f:
            f.write(text)
        return path

    def cleanup(self):
        shutil.rmtree(self.dir)


class SchemaTest(unittest.TestCase):
    def test_enum_value_strings_follow_the_prefix_convention(self):
        q = SCHEMA.questions_by_name["additional_sensors"]
        self.assertEqual([v.value for v in q.enum_values],
                         ["turner_c_flour", "turner_c_fluor", "turner_c_fluor_2", "aml", "ppk", "none"])
        self.assertEqual(SCHEMA.questions_by_name["type"].choices, ["bot", "hub"])

    def test_identity_questions(self):
        self.assertEqual([q.name for q in SCHEMA.questions if q.identity], ["type", "fleet_id", "mode", "bot_id", "hub_id"])

    def test_multiselect_round_trip(self):
        q = SCHEMA.questions_by_name["comms_links"]
        numbers = q.from_debconf("xbee,wifi")
        self.assertEqual(q.to_debconf(numbers), "xbee, wifi")

    def test_deprecated_values_map(self):
        q = SCHEMA.questions_by_name["bot_type"]
        self.assertEqual(q.to_debconf(q.from_debconf("echo")), "pam")
        with self.assertRaises(fc.FleetConfigError):
            q.from_debconf("sonar")


class MigrationChainTest(unittest.TestCase):
    def test_every_version_has_a_migration_step(self):
        """A file of any earlier version migrates step by step to the current one."""
        self.assertEqual(sorted(fc.MIGRATIONS), list(range(1, SCHEMA.version)))

    def test_chain_is_applied_in_order(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_fleet7.cfg"))
        notes, problems = fc.migrate(SCHEMA, cfg)
        self.assertEqual(problems, [])
        self.assertEqual([n for n in notes if n.startswith("migrated to version")],
                         ["migrated to version {}".format(v) for v in range(2, SCHEMA.version + 1)])


class MigrationTest(unittest.TestCase):
    def setUp(self):
        self.cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_fleet7.cfg"))
        self.assertEqual(self.cfg.version, 1)
        self.notes, self.problems = fc.migrate(SCHEMA, self.cfg)

    def test_migrates_cleanly(self):
        self.assertEqual(self.problems, [])
        self.assertEqual(self.cfg.version, 2)
        self.assertEqual(fc.validate(SCHEMA, self.cfg), [])
        self.assertEqual(len(self.cfg.debconf), 0)
        self.assertEqual(len(self.cfg.debconf_override), 0)

    def test_values_are_typed_and_deprecated_ones_replaced(self):
        s = self.cfg.settings
        NS = SCHEMA.NodeSettings
        self.assertEqual(s.bot_type, NS.BOT_TYPE_PAM)          # echo -> pam
        self.assertEqual(s.arduino_type, NS.ARDUINO_TYPE_USB)  # usb_new -> usb
        self.assertEqual(list(s.comms_links), [NS.COMMS_LINK_XBEE, NS.COMMS_LINK_WIFI])
        self.assertEqual(s.electronics_stack, 2)
        self.assertEqual(s.rf_encryption_password, "0123456789abcdef0123456789abcdef")
        self.assertEqual(s.user_role, NS.USER_ROLE_ADVANCED)

    def test_identity_answers_are_dropped_with_a_note(self):
        self.assertFalse(self.cfg.settings.HasField("mode"))
        self.assertTrue(any("jaiabot-embedded/mode: dropped" in n for n in self.notes))

    def test_unanswered_questions_get_explicit_defaults(self):
        s = self.cfg.settings
        NS = SCHEMA.NodeSettings
        self.assertEqual(s.led_type, NS.LED_TYPE_NONE)
        self.assertEqual(s.warp, 1)
        self.assertEqual(list(s.additional_sensors), [NS.ADDITIONAL_SENSOR_NONE])
        self.assertFalse(s.HasField("hub_id"))

    def test_override_converted(self):
        self.assertEqual(len(self.cfg.override), 1)
        o = self.cfg.override[0]
        NS = SCHEMA.NodeSettings
        self.assertEqual(o.id, 2)
        self.assertEqual(o.settings.bot_type, NS.BOT_TYPE_BIO)
        self.assertEqual(list(o.settings.camera_positions), [NS.CAMERA_POSITION_OUTWARD])
        self.assertFalse(o.settings.HasField("imu_type"))

    def test_merge_for_node(self):
        NS = SCHEMA.NodeSettings
        bot1 = fc.node_settings_for(SCHEMA, self.cfg, "bot", 1)
        bot2 = fc.node_settings_for(SCHEMA, self.cfg, "bot", 2)
        self.assertEqual(bot1.bot_type, NS.BOT_TYPE_PAM)
        self.assertEqual(bot2.bot_type, NS.BOT_TYPE_BIO)
        self.assertEqual(list(bot1.camera_positions), [NS.CAMERA_POSITION_AFT, NS.CAMERA_POSITION_FORE])
        self.assertEqual(list(bot2.camera_positions), [NS.CAMERA_POSITION_OUTWARD])

    def test_selections_for_preseed(self):
        bot2 = fc.node_settings_for(SCHEMA, self.cfg, "bot", 2)
        sel = {d["key"]: d for d in fc.debconf_selections(SCHEMA, bot2)}
        self.assertEqual(sel["jaiabot-embedded/bot_type"], {"key": "jaiabot-embedded/bot_type", "type": "SELECT", "value": "bio"})
        self.assertEqual(sel["jaiabot-embedded/camera_positions"]["value"], "outward")
        self.assertEqual(sel["jaiabot-embedded/comms_links"]["value"], "xbee, wifi")
        self.assertNotIn("jaiabot-embedded/bot_id", sel)
        self.assertNotIn("jaiabot-embedded/type", sel)

    def test_migrated_text_round_trips(self):
        text = fc.fleet_config_text(self.cfg)
        self.assertIn("version: 2", text)
        self.assertIn("bot_type: BOT_TYPE_PAM", text)
        self.assertNotIn("debconf {", text)
        again = SCHEMA.FleetConfig()
        fc.text_format.Parse(text, again)
        self.assertEqual(again, self.cfg)
        self.assertEqual(fc.migrate(SCHEMA, again), ([], []))


class NoCloudHubMigrationTest(unittest.TestCase):
    """A 2.y fleet without hub 30 never had a CloudHub."""

    def setUp(self):
        self.cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_no_cloudhub.cfg"))
        self.notes, self.problems = fc.migrate(SCHEMA, self.cfg)

    def test_migrates_without_a_cloudhub(self):
        self.assertEqual(self.problems, [])
        self.assertFalse(self.cfg.includes_cloudhub)
        self.assertEqual(fc.validate(SCHEMA, self.cfg), [])

    def test_a_fleet_with_hub_30_keeps_its_cloudhub(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_fleet7.cfg"))
        fc.migrate(SCHEMA, cfg)
        self.assertTrue(cfg.includes_cloudhub)


class FluorometerMigrationTest(unittest.TestCase):
    """2.y renamed turner_c_flour, so a v1 file may carry either spelling."""

    def setUp(self):
        self.cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_fluorometers.cfg"))
        self.notes, self.problems = fc.migrate(SCHEMA, self.cfg)

    def test_both_spellings_migrate(self):
        NS = SCHEMA.NodeSettings
        self.assertEqual(self.problems, [])
        self.assertEqual(list(self.cfg.settings.additional_sensors),
                         [NS.ADDITIONAL_SENSOR_TURNER_C_FLUOR, NS.ADDITIONAL_SENSOR_AML])
        self.assertEqual(list(self.cfg.override[0].settings.additional_sensors),
                         [NS.ADDITIONAL_SENSOR_TURNER_C_FLUOR, NS.ADDITIONAL_SENSOR_TURNER_C_FLUOR_2])

    def test_selections_use_the_new_spelling(self):
        bot1 = fc.node_settings_for(SCHEMA, self.cfg, "bot", 1)
        sel = {d["key"]: d for d in fc.debconf_selections(SCHEMA, bot1)}
        self.assertEqual(sel["jaiabot-embedded/additional_sensors"]["value"], "turner_c_fluor, aml")


class MigrationFailureTest(unittest.TestCase):
    def test_unknown_and_invalid_values_are_reported_by_name(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_bad_values.cfg"))
        notes, problems = fc.migrate(SCHEMA, cfg)
        self.assertEqual(sorted(problems), sorted([
            "jaiabot-embedded/bot_type: 'sonar' is not one of hydro, pam, bio, none",
            "jaiabot-embedded/no_such_question: not a jaiabot-embedded question",
            "jaiabot-embedded/warp: '3' is not one of 1, 2, 5, 10, 20, 30, 40, 50",
        ]))

    def test_retired_value_with_no_replacement_is_refused_by_name(self):
        """A BNO055 has to be swapped for a BNO085: there is nothing to migrate to."""
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_retired_imu.cfg"))
        notes, problems = fc.migrate(SCHEMA, cfg)
        self.assertEqual(problems, ["jaiabot-embedded/imu_type: 'bno055' is no longer supported"])

    def test_cloudhub_requires_auth(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_cloudhub_no_auth.cfg"))
        fc.migrate(SCHEMA, cfg)
        problems = fc.validate(SCHEMA, cfg)
        self.assertIn("cloudhub: required when hub 30 (CloudHub) is in the fleet", problems)

    def cloudhub_cfg(self, extra=""):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_cloudhub_no_auth.cfg"))
        fc.migrate(SCHEMA, cfg)
        fc.text_format.Merge(
            'cloudhub { base_uri: "fleet9.example" admin_email: "a@example" '
            'smtp_address: "smtp://localhost:587" }\n' + extra, cfg)
        return cfg

    def test_cloudhub_defaults(self):
        cfg = self.cloudhub_cfg()
        self.assertEqual(fc.validate(SCHEMA, cfg), [])

    def test_cloudhub_smtp_overrides(self):
        cfg = self.cloudhub_cfg('cloudhub { smtp_sender: "noreply@auth.example" '
                                'smtp_credentials_ssm_parameter: "/example/smtp" }\n')
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        problems = fc.validate(SCHEMA, self.cloudhub_cfg(
            'cloudhub { smtp_sender: "" smtp_credentials_ssm_parameter: "" }\n'))
        self.assertIn("cloudhub.smtp_sender: must not be empty; omit it to use the default", problems)
        self.assertIn("cloudhub.smtp_credentials_ssm_parameter: must not be empty; omit it to use the default",
                      problems)
        # what create_cloudhub falls back to when the fleet config says nothing
        self.assertEqual(cfg.customer, "jaia")
        self.assertFalse(cfg.cloudhub.HasField("data_bucket"))

    def test_cloudhub_settings_are_carried(self):
        cfg = self.cloudhub_cfg('customer: "acme"\ncloudhub { data_bucket: "acme-fleet9" }\n')
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        self.assertEqual(cfg.customer, "acme")
        self.assertEqual(cfg.cloudhub.data_bucket, "acme-fleet9")
        self.assertEqual(cfg.cloudhub.base_uri, "fleet9.example")

    def real_fleet_without_cloudhub(self, extra=""):
        """v1_retired_imu has hubs: [1], so with no marker it is a real fleet lacking a CloudHub."""
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_retired_imu.cfg"))
        fc.text_format.Merge("version: {}\n".format(SCHEMA.version) + extra, cfg)
        return cfg

    def test_real_fleet_that_lost_its_cloudhub_is_refused(self):
        """It says it has one and does not, which is the mistake the rule exists for."""
        problems = fc.validate(SCHEMA, self.real_fleet_without_cloudhub())
        self.assertTrue(
            any(p.startswith("hubs: this fleet says it has a CloudHub") for p in problems),
            problems)

    def test_a_real_fleet_may_say_it_has_no_cloudhub(self):
        """Not every fleet is sold with one, and saying so is how the two are told
        apart from a config that lost hub 30 by accident."""
        cfg = self.real_fleet_without_cloudhub("includes_cloudhub: false\n")
        self.assertEqual([p for p in fc.validate(SCHEMA, cfg) if p.startswith("hubs:")], [])

    def test_saying_it_has_none_while_holding_one_is_refused(self):
        cfg = self.real_fleet_without_cloudhub("includes_cloudhub: false\n")
        cfg.hubs.append(30)
        self.assertTrue(
            any(p.startswith("includes_cloudhub: false, but hub 30") for p in fc.validate(SCHEMA, cfg)),
            fc.validate(SCHEMA, cfg))

    def test_includes_cloudhub_defaults_to_true(self):
        """An existing file says nothing, so it is still held to the rule."""
        self.assertFalse(self.real_fleet_without_cloudhub().HasField("includes_cloudhub"))
        self.assertTrue(self.real_fleet_without_cloudhub().includes_cloudhub)

    def test_a_simulation_may_have_no_cloudhub(self):
        """The rule that broke the VirtualFleet before: it must not fire on a simulation."""
        cfg = self.real_fleet_without_cloudhub("fleet_type: FLEET_TYPE_SIMULATION\n")
        self.assertEqual([p for p in fc.validate(SCHEMA, cfg) if p.startswith("hubs:")], [])

    def test_fleet_type_defaults_to_real(self):
        """An existing file says nothing, so it is held to the real-fleet rule."""
        cfg = self.real_fleet_without_cloudhub()
        self.assertFalse(cfg.HasField("fleet_type"))
        self.assertFalse(fc.is_simulation(cfg))

    def test_cloudhub_settings_refuse_blanks(self):
        cfg = self.cloudhub_cfg('customer: ""\ncloudhub { data_bucket: "" }\n')
        problems = fc.validate(SCHEMA, cfg)
        self.assertIn("customer: must not be empty; omit it to use the default", problems)
        self.assertIn("cloudhub.data_bucket: must not be empty; omit it to use the default", problems)

    def test_cloudhub_without_a_cloudhub_hub_is_refused(self):
        cfg = SCHEMA.FleetConfig()
        fc.text_format.Merge(
            'fleet: 7\n'
            'hubs: [1]\n'
            'ssh { hub { id: 1 private_key: "k\\n" public_key: "ssh-ed25519 AAAA hub1_fleet7" } }\n'
            'wlan_password: "x"\n'
            'service_vpn_enabled: false\n'
            'cloudhub { base_uri: "a" admin_email: "b" smtp_address: "c" }\n', cfg)
        self.assertIn("cloudhub: set, but hub 30 (CloudHub) is not in the fleet",
                      fc.validate(SCHEMA, cfg))

    def test_only_the_cloudhub_may_go_without_a_private_key(self):
        cfg = SCHEMA.FleetConfig()
        fc.text_format.Merge(
            'version: 2\n'
            'fleet: 7\n'
            'hubs: [1, 2, 30]\n'
            'ssh {\n'
            '  hub { id: 1 private_key: "" public_key: "ssh-ed25519 AAAA hub1_fleet7" }\n'
            '  hub { id: 30 private_key: "" public_key: "ssh-ed25519 AAAA hub30_fleet7" }\n'
            '}\n'
            'wlan_password: "x"\n'
            'service_vpn_enabled: false\n'
            'cloudhub { base_uri: "a" admin_email: "b" smtp_address: "c" }\n', cfg)
        problems = fc.validate(SCHEMA, cfg)
        self.assertIn("ssh: hub 1: private_key must be set (only the CloudHub keeps its key to itself)", problems)
        self.assertIn("ssh: no hub key for hub 2", problems)
        self.assertEqual([p for p in problems if "30" in p], [])

        del cfg.ssh.hub[1]
        self.assertEqual([p for p in fc.validate(SCHEMA, cfg) if "30" in p], [],
                         "the CloudHub's key is recorded only once the CloudHub exists")

    def test_cloudhub_vpn_address_without_jaia_ip(self):
        with mock.patch.object(fc.shutil, "which", return_value=None):
            self.assertEqual(fc.jaia_ip("addr", "hub", 3, 30, net="cloudhub_vpn"), "fd0f:77ac:4fdf:3::1:1e")
            self.assertEqual(fc.jaia_ip("addr", "hub", 1000, 30, net="cloudhub_vpn"), "fd0f:77ac:4fdf:3e8::1:1e")

    def test_newer_than_tool_is_refused(self):
        with tempfile.NamedTemporaryFile("w", suffix=".cfg", delete=False) as f:
            f.write("version: 99\nfleet: 1\nssh {}\nwlan_password: \"x\"\nservice_vpn_enabled: false\n")
        try:
            with self.assertRaises(fc.FleetConfigError) as ctx:
                fc.parse_fleet_config(SCHEMA, f.name)
            self.assertIn("newer than this software", str(ctx.exception))
        finally:
            os.unlink(f.name)


class CommandTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()

    def tearDown(self):
        self.env.cleanup()

    def test_version(self):
        result = self.env.run("version")
        self.assertEqual(result.stdout.strip(), str(SCHEMA.version))

    def test_binary_dispatch(self):
        result = self.env.run("--binary=jaia admin fleet version")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(SCHEMA.version))

    def test_has_cloudhub_answers_for_a_fleet_that_has_one(self):
        result = self.env.run("has_cloudhub", fixture("v2_no_permanent_keys.cfg"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual("yes", result.stdout.strip())

    def without_a_cloudhub(self, name, extra):
        """The fixture with hub 30 and its auth block taken out, as a fleet built
        without one actually looks."""
        path = os.path.join(self.env.dir, name)
        with open(fixture("v2_no_permanent_keys.cfg")) as f:
            text = re.sub(r"cloudhub \{.*?\n\}\n", "", f.read().replace("hubs: 30\n", ""),
                          flags=re.DOTALL)
        with open(path, "w") as f:
            f.write(text + extra)
        return path

    def test_has_cloudhub_answers_for_a_fleet_built_without_one(self):
        """What the major upgrade asks before it decides whether to expect one."""
        path = self.without_a_cloudhub("nocloud.cfg", "includes_cloudhub: false\n")
        result = self.env.run("has_cloudhub", path)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual("no", result.stdout.strip())

    def test_has_cloudhub_answers_no_for_a_simulation(self):
        """A VirtualFleet has none whatever the field says, and the upgrade has to
        hear the same answer the validator acts on."""
        path = self.without_a_cloudhub("sim.cfg", "fleet_type: FLEET_TYPE_SIMULATION\n")
        result = self.env.run("has_cloudhub", path)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual("no", result.stdout.strip())

    def test_nodes_lists_the_hubs_and_bots(self):
        """What the major upgrade compares with the hub's inventory."""
        result = self.env.run("nodes", fixture("v2_no_permanent_keys.cfg"))
        self.assertEqual(result.returncode, 0, result.stderr)
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v2_no_permanent_keys.cfg"))
        self.assertEqual(result.stdout.splitlines(),
                         ["hubs " + " ".join(str(h) for h in sorted(cfg.hubs)),
                          "bots " + " ".join(str(b) for b in sorted(cfg.bots))])

    def test_nodes_reads_a_2y_config(self):
        """A hub that has not been upgraded yet holds a version 1 file."""
        result = self.env.run("nodes", fixture("v1_fleet7.cfg"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), ["hubs 1 30", "bots 1 2"])

    def test_validate_reports_migration(self):
        result = self.env.run("validate", fixture("v1_fleet7.cfg"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("migration to version 2 succeeds", result.stdout)

    def test_validate_fails_loudly(self):
        result = self.env.run("validate", fixture("v1_bad_values.cfg"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("no_such_question", result.stderr)
        self.assertIn("'jaia admin fleet edit'", result.stderr)

    def test_migrate_writes_current_version(self):
        out = os.path.join(self.env.dir, "fleet7.cfg")
        result = self.env.run("migrate", fixture("v1_fleet7.cfg"), "-o", out)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.env.run("validate", out)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("valid", result.stdout)
        self.assertNotIn("migration", result.stdout)

    @needs_render_deps
    def test_generate_renders_preseed_and_stores_migrated_config(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "hub", "1")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        init = os.path.join(bootdir, "jaiabot", "init")
        with open(os.path.join(init, "first-boot.preseed.yml")) as f:
            preseed = f.read()
        self.assertIn("jaiabot-embedded jaiabot-embedded/hub_id string 1", preseed)
        self.assertIn("jaiabot-embedded jaiabot-embedded/bot_type select pam", preseed)
        self.assertIn("jaiabot-embedded jaiabot-embedded/comms_links multiselect xbee, wifi", preseed)
        self.assertIn("no-touch-required sk-ssh-ed25519@openssh.com AAAAhub1 hub1_fleet7", preseed)
        self.assertNotIn("requires_jaia_fleet_config_tool", preseed)
        yaml.safe_load(preseed)
        with open(os.path.join(init, "fleet7.cfg")) as f:
            stored = f.read()
        self.assertIn("version: 2", stored)
        self.assertIn("settings {", stored)
        self.assertTrue(os.path.exists(os.path.join(init, "hub1_fleet7")))
        self.assertTrue(os.path.exists(os.path.join(init, "id_vpn_tmp.pub")))
        self.assertTrue(os.path.exists(os.path.join(init, "iridium.json")))

    @needs_render_deps
    def test_generate_applies_override_for_bot(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "bot", "2")
        self.assertEqual(result.returncode, 0, result.stderr)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = f.read()
        self.assertIn("jaiabot-embedded/bot_type select bio", preseed)
        self.assertIn("jaiabot-embedded/camera_positions multiselect outward", preseed)
        self.assertIn("jaiabot-embedded/bot_id string 2", preseed)

    @needs_render_deps
    def test_generate_points_a_node_at_its_own_cloudhub(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "bot", "2")
        self.assertEqual(result.returncode, 0, result.stderr)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = f.read()
        self.assertIn("pair-with-cloudhub.sh fleet7.jaia.tech", preseed)
        self.assertIn("enable wg-quick@wg_jaia_ch7", preseed)

    def test_generate_writes_the_cloudhub_seed(self):
        """The optional SMTP settings appear only when the config sets them, so a config
        without them still produces the seed earlier releases wrote."""
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "hub", "30",
                              "--action", "write_cloudhub_env")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        with open(os.path.join(bootdir, "jaiabot", "init", "cloudhub_env.sh")) as f:
            seed = f.read().splitlines()
        self.assertEqual([line.split("=")[0] for line in seed],
                         ["AUTH_BASE_URI", "AUTH_ADMIN_EMAIL", "AUTH_SMTP_ADDRESS", "CLOUDHUB_DATA_BUCKET"])

        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_fleet7.cfg"))
        fc.migrate(SCHEMA, cfg)
        cfg.cloudhub.smtp_sender = "noreply@auth.example"
        cfg.cloudhub.smtp_credentials_ssm_parameter = "arn:aws:ssm:us-east-1:123456789012:parameter/example/smtp"
        with_smtp = os.path.join(self.env.dir, "with_smtp.cfg")
        with open(with_smtp, "w") as f:
            f.write(fc.fleet_config_text(cfg))
        shutil.rmtree(bootdir)
        bootdir = self.env.bootdir()
        result = self.env.run("generate", with_smtp, "--bootdir", bootdir, "hub", "30",
                              "--action", "write_cloudhub_env")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        with open(os.path.join(bootdir, "jaiabot", "init", "cloudhub_env.sh")) as f:
            seed = f.read()
        self.assertIn("AUTH_SMTP_SENDER=noreply@auth.example\n", seed)
        self.assertIn("AUTH_SMTP_CREDENTIALS_SSM_PARAMETER=arn:aws:ssm:us-east-1:123456789012:parameter/example/smtp\n", seed)

    @needs_render_deps
    def test_generate_leaves_the_cloudhub_nothing_to_enroll_with(self):
        """Hub 30 is the server: given its own base URI it would enroll with itself."""
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "hub", "30")
        self.assertEqual(result.returncode, 0, result.stderr)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = f.read()
        self.assertNotIn("fleet7.jaia.tech", preseed)
        self.assertIn("disable wg-quick@wg_jaia_ch7", preseed)
        yaml.safe_load(preseed)

    @needs_render_deps
    def test_generate_for_a_simulation_with_no_cloudhub(self):
        """A simulation may ask for the service VPN with no CloudHub to reach, which
        the template has to render rather than fail on."""
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v2_simulation.cfg"), "--bootdir", bootdir, "hub", "1")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = f.read()
        self.assertIn("disable wg-quick@wg_jaia_ch6", preseed)
        yaml.safe_load(preseed)

    @needs_render_deps
    def test_generate_without_permanent_keys_or_overrides(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v2_no_permanent_keys.cfg"), "--bootdir", bootdir, "hub", "30")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = f.read()
        # the empty repeated field renders as no keys rather than failing the render
        self.assertIn("- path: /etc/jaiabot/ssh/jaia_authorized_keys\n    content: |\n", preseed)
        yaml.safe_load(preseed)

    @needs_render_deps
    def test_generate_without_jaia_ip_uses_the_2y_tool(self):
        fake_bin = os.path.join(self.env.dir, "bin")
        os.remove(os.path.join(fake_bin, "jaia_ip"))
        calls = os.path.join(self.env.dir, "calls")
        name = "jaia-ip.py"
        with open(os.path.join(fake_bin, name), "w") as f:
            f.write('#!/bin/sh\necho "{} $*" >> {}\ncase "$*" in *gateway*) echo 10.23.7.1 ;; *) echo 10.23.7.11 ;; esac\n'.format(name, calls))
        os.chmod(os.path.join(fake_bin, name), 0o755)
        self.env.env["PATH"] = fake_bin + os.pathsep + "/usr/bin:/bin"
        if shutil.which("jaia_ip", path=self.env.env["PATH"]):
            self.skipTest("jaia_ip is installed in /usr/bin")
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "hub", "1")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        with open(calls) as f:
            self.assertEqual(f.read().splitlines(),
                             ["jaia-ip.py addr --net wlan --fleet_id 7 --ipv4 --node hub --node_id 1",
                              "jaia-ip.py addr --net wlan --fleet_id 7 --ipv4 --node gateway"])

    @needs_render_deps
    def test_generate_accepts_the_cloudhub_key_only_from_its_vpn_address(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_fleet7.cfg"), "--bootdir", bootdir, "hub", "1",
                              "--action", "first_boot", "--action", "new_hub_script")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cloudhub = 'from="fd0f:77ac:4fdf:7::1:1e" ssh-ed25519 AAAAhub30 hub30_fleet7'
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            preseed = yaml.safe_load(f)
        authorized = next(w["content"] for w in preseed["write_files"]
                          if w["path"] == "/etc/jaiabot/ssh/hub_authorized_keys").splitlines()
        self.assertEqual(authorized, ["no-touch-required sk-ssh-ed25519@openssh.com AAAAhub1 hub1_fleet7", cloudhub])
        with open(os.path.join(bootdir, "new_hub.sh")) as f:
            self.assertIn("\n" + cloudhub + "\n", f.read())

    def test_set_cloudhub_key_records_only_the_public_key(self):
        path = self.env.without_cloudhub_key()
        self.assertEqual(self.env.run("validate", path).returncode, 0)
        result = self.env.run("set_cloudhub_key", path, self.env.pubkey_file("ssh-ed25519 AAAAnew hub30_fleet6\n"))
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertNotIn("Replacing", result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, path)
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        key = next(k for k in cfg.ssh.hub if k.id == 30)
        self.assertEqual((key.private_key, key.public_key), ("", "ssh-ed25519 AAAAnew hub30_fleet6"))

        result = self.env.run("set_cloudhub_key", path, self.env.pubkey_file("ssh-ed25519 AAAAnewer hub30_fleet6\n"))
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("Replacing the CloudHub's previous key", result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, path)
        self.assertEqual([k.public_key for k in cfg.ssh.hub if k.id == 30], ["ssh-ed25519 AAAAnewer hub30_fleet6"])

    def test_set_cloudhub_key_refuses_a_fleet_without_a_cloudhub(self):
        pubkey = self.env.pubkey_file("ssh-ed25519 AAAAnew hub30_fleet6\n")
        no_cloudhub = os.path.join(self.env.dir, "no_cloudhub.cfg")
        with open(no_cloudhub, "w") as f:
            f.write('version: 2\nfleet: 6\nfleet_type: FLEET_TYPE_SIMULATION\nhubs: [1]\n'
                    'ssh { hub { id: 1 private_key: "handle\\n" public_key: "ssh-ed25519-sk AAAA hub1_fleet6" } }\n'
                    'wlan_password: "x"\nservice_vpn_enabled: false\n')
        self.assertEqual(self.env.run("validate", no_cloudhub).returncode, 0)
        result = self.env.run("set_cloudhub_key", no_cloudhub, pubkey)
        self.assertEqual(result.returncode, 1)
        self.assertIn("hub 30 (CloudHub) is not in", result.stderr)
        path = self.env.without_cloudhub_key()
        result = self.env.run("set_cloudhub_key", path, self.env.pubkey_file("one\ntwo\n"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("expected one public key line", result.stderr)

    @needs_render_deps
    def test_generate_for_a_cloudhub_writes_no_private_key(self):
        path = self.env.without_cloudhub_key()
        bootdir = self.env.bootdir()
        init = os.path.join(bootdir, "jaiabot", "init")
        result = self.env.run("generate", path, "--bootdir", bootdir, "hub", "30", "--action", "hub_ssh_keys")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("it makes its own at first boot", result.stdout)
        self.assertEqual([f for f in os.listdir(init) if f.startswith("hub")], [])

        self.env.run("set_cloudhub_key", path, self.env.pubkey_file("ssh-ed25519 AAAAnew hub30_fleet6\n"))
        result = self.env.run("generate", path, "--bootdir", bootdir, "hub", "30", "--hub-ssh-keys-only")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual([f for f in os.listdir(init) if f.startswith("hub")], ["hub30_fleet6.pub"])
        with open(os.path.join(init, "hub30_fleet6.pub")) as f:
            self.assertEqual(f.read(), "ssh-ed25519 AAAAnew hub30_fleet6\n")

    @needs_render_deps
    def test_generate_warns_when_the_cloudhub_has_no_key_yet(self):
        path = self.env.without_cloudhub_key()
        bootdir = self.env.bootdir()
        result = self.env.run("generate", path, "--bootdir", bootdir, "bot", "1")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("WARNING: no key for the CloudHub (hub 30) yet", result.stdout)
        with open(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")) as f:
            self.assertNotIn("hub30", f.read())

    def test_generate_refuses_invalid_config_before_writing(self):
        bootdir = self.env.bootdir()
        result = self.env.run("generate", fixture("v1_bad_values.cfg"), "--bootdir", bootdir, "bot", "1")
        self.assertEqual(result.returncode, 1)
        self.assertFalse(os.path.exists(os.path.join(bootdir, "jaiabot", "init", "first-boot.preseed.yml")))

    @needs_render_deps
    def test_template_sentinel_fails_without_the_tool(self):
        with open(TEMPLATE) as f:
            template = jinja2.Template(f.read())  # default Undefined, as older generators use
        with self.assertRaises(jinja2.UndefinedError):
            template.render({"fleet": 1, "debconf": [], "ssh": {"hub": [], "permanentAuthorizedKeys": []},
                             "bots": [], "hubs": [], "this": {"type": "bot", "id": 1, "mode": "runtime"},
                             "serviceVpnEnabled": False, "wlanPassword": "x"})

    def test_binary_dispatch_create_help(self):
        result = self.env.run("--binary=jaia admin fleet create", "--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("fleetcfg", result.stdout)


def settings_answers(groups, chosen):
    """The answers the create flow asks for, in order, as ask_settings asks them."""
    answers = []
    given = {}
    for q in SCHEMA.questions:
        if q.identity or q.per_node or q.group not in groups:
            continue
        if q.ask_if:
            field, equals = q.ask_if
            cond = SCHEMA.questions_by_name[field]
            if given.get(field, cond.default) != equals:
                continue
        answer = chosen.get(q.name, q.default if q.default is not None else "")
        given[q.name] = answer
        answers.append(answer)
    return answers


ALL_GROUPS = {"ALL", "BOT", "HUB"}


def node_answers(hubs, bots, value="<default>"):
    """One answer per node for each question that is different on every node."""
    out = []
    for node_type, ids in (("hub", hubs), ("bot", bots)):
        for _ in ids:
            out += [value] * len(fc.per_node_questions(SCHEMA, node_type))
    return out


def accept(settings, groups=ALL_GROUPS):
    """One <default> per question the flow asks for these settings."""
    asked = [q for q in SCHEMA.questions
             if not q.identity and q.group in groups and fc.asked(q, SCHEMA, settings)]
    return ["<default>"] * len(asked)


class CreateTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)

    def run_edit(self, path, answers):
        answers_file = os.path.join(self.env.dir, "edit-answers.txt")
        with open(answers_file, "w") as f:
            f.write("\n".join(answers) + "\n")
        return self.env.run("edit", path, "--answers", answers_file), path

    def run_create(self, answers, *extra):
        path = os.path.join(self.env.dir, "answers.txt")
        with open(path, "w") as f:
            f.write("\n".join(answers) + "\n")
        out = os.path.join(self.env.dir, "fleet7.cfg")
        result = self.env.run("create", out, "--answers", path, *extra)
        return result, out

    def test_test_keys_need_no_yubikey(self):
        with open(os.path.join(self.env.dir, "bin", "ykman"), "w") as f:
            f.write("#!/bin/sh\necho 'no Yubikey here' >&2\nexit 1\n")
        answers = ["7", "no", "no", "1, 2", "1", "", "wifipass", "no"]
        answers += settings_answers(ALL_GROUPS, {}) + ["no"] + node_answers([1, 2], [1])
        result, out = self.run_create(answers, "--test-keys")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("never use it for a real deployment", result.stderr)
        keys = {k.id: k for k in fc.parse_fleet_config(SCHEMA, out).ssh.hub}
        self.assertEqual(keys[1].public_key, "ssh-ed25519 AAAAhub1_fleet7_test_key hub1_fleet7_test_key")
        self.assertEqual(keys[2].private_key, "PRIVATE hub2_fleet7_test_key\n")

    def test_without_test_keys_a_hub_key_needs_a_yubikey(self):
        with open(os.path.join(self.env.dir, "bin", "ykman"), "w") as f:
            f.write("#!/bin/sh\nexit 1\n")
        answers = ["7", "no", "no", "1", "1", "", "wifipass", "no"]
        result, _ = self.run_create(answers)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ykman failed", result.stderr)

    def test_edit_with_test_keys_keeps_existing_hub_keys(self):
        answers = ["7", "no", "no", "1", "1", "", "wifipass", "no"]
        answers += settings_answers(ALL_GROUPS, {}) + ["no"] + node_answers([1], [1])
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        before = {k.id: k.public_key for k in fc.parse_fleet_config(SCHEMA, out).ssh.hub}
        edit = ["<default>"] * 3 + ["1, 2"] + ["<default>"] * 3 + ["<default>"]
        edit += accept(fc.parse_fleet_config(SCHEMA, out).settings) + ["no"] + node_answers([1, 2], [1])
        answers_file = os.path.join(self.env.dir, "edit-answers.txt")
        with open(answers_file, "w") as f:
            f.write("\n".join(edit) + "\n")
        result = self.env.run("edit", out, "--answers", answers_file, "--test-keys")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        after = {k.id: k.public_key for k in fc.parse_fleet_config(SCHEMA, out).ssh.hub}
        self.assertEqual(after[1], before[1])
        self.assertEqual(after[2], "ssh-ed25519 AAAAhub2_fleet7_test_key hub2_fleet7_test_key")

    def test_creates_a_valid_current_version_file(self):
        answers = [
            "abc", "7",                      # fleet id: re-asked until it is in range
            "no",                            # a simulation? no, so real
            "yes",                           # and it has a CloudHub
            "1, 2", "1, 2",                  # physical hubs, bots
            "ssh-ed25519 AAAAperm me", "",   # permanent keys
            "wifipass", "yes",               # wlan password, service vpn
            "<default>",                     # base_uri: fleet7.jaia.tech
            "nobody", "admin@example.com",   # admin_email: re-asked until it is one
            "<default>",                     # smtp_address
            "", "",                          # smtp_sender, smtp_credentials_ssm_parameter: defaults
        ]
        answers += settings_answers(ALL_GROUPS, {"comms_links": "xbee, iridium", "bot_type": "pam",
                                                 "pam_connection_type": "uart", "user_role": "advanced"})
        answers += ["yes", "", "2"] + settings_answers({"ALL", "BOT"}, {"comms_links": "xbee, iridium",
                                                                       "bot_type": "bio",
                                                                       "camera_positions": "outward"})
        answers += ["no"]
        answers += ["VIN001", "TAIL001", "VIN002", "TAIL002"]
        answers += ["300234010753370", "300234010753371", "SBD_ROCKBLOCK", "rbuser", "rbpass"]
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("Output written to", result.stdout)

        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        self.assertEqual((cfg.version, cfg.fleet, list(cfg.hubs), list(cfg.bots)),
                         (SCHEMA.version, 7, [1, 2, 30], [1, 2]))
        keys = {k.id: k for k in cfg.ssh.hub}
        self.assertEqual(keys[1].public_key, "no-touch-required ssh-ed25519-sk AAAAhub1_fleet7 hub1_fleet7")
        self.assertNotIn(30, keys, "the CloudHub makes its own key")
        self.assertEqual(keys[1].private_key, "PRIVATE hub1_fleet7\n")
        self.assertEqual(cfg.ssh.vpn_tmp.public_key, "ssh-ed25519 AAAAid_vpn_tmp id_vpn_tmp")
        self.assertEqual(list(cfg.ssh.permanent_authorized_keys), ["ssh-ed25519 AAAAperm me"])
        self.assertEqual((cfg.wlan_password, cfg.service_vpn_enabled), ("wifipass", True))
        self.assertEqual([cfg.cloudhub.base_uri, cfg.cloudhub.admin_email, cfg.cloudhub.smtp_address],
                         ["fleet7.jaia.tech", "admin@example.com", "submission://smtp.postmarkapp.com:587"])
        self.assertFalse(cfg.cloudhub.HasField("smtp_sender"), "a blank answer leaves the default")
        self.assertFalse(cfg.cloudhub.HasField("smtp_credentials_ssm_parameter"))

        s = cfg.settings
        q = SCHEMA.questions_by_name
        self.assertEqual(q["comms_links"].to_debconf(list(s.comms_links)), "xbee, iridium")
        self.assertEqual(q["bot_type"].to_debconf(s.bot_type), "pam")
        self.assertEqual(q["pam_connection_type"].to_debconf(s.pam_connection_type), "uart")
        self.assertEqual(q["user_role"].to_debconf(s.user_role), "advanced")
        # every shared question is answered; identity and per-node ones are never here
        for question in SCHEMA.questions:
            if question.identity or question.per_node:
                self.assertFalse(s.HasField(question.name), question.name)
            elif not question.repeated:
                self.assertTrue(s.HasField(question.name), question.name)

        # the answers that differ on every node are stored against that node
        by_node = {(fc.node_type_name(SCHEMA, o.type), o.id): o.settings for o in cfg.override}
        self.assertEqual(by_node[("bot", 1)].bot_vin, "VIN001")
        self.assertEqual(by_node[("bot", 1)].tail_serial_number, "TAIL001")
        self.assertEqual(by_node[("bot", 2)].bot_vin, "VIN002")
        # bot 2 already had an override: the per-node answers join it
        self.assertEqual(q["bot_type"].to_debconf(by_node[("bot", 2)].bot_type), "bio")

        self.assertEqual(len(cfg.override), 2)
        o = by_node[("bot", 2)]
        self.assertEqual(sorted(f.name for f, _ in o.ListFields()),
                         ["bot_type", "bot_vin", "camera_positions", "pam_connection_type", "tail_serial_number"])
        self.assertEqual(q["pam_connection_type"].to_debconf(o.pam_connection_type), "none")

        sbd = cfg.comms.iridium_sbd
        self.assertEqual([(b.id, b.imei) for b in sbd.bot], [(1, "300234010753370"), (2, "300234010753371")])
        self.assertEqual((sbd.rockblock.username, sbd.rockblock.password), ("rbuser", "rbpass"))

        result = self.env.run("validate", out)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_no_cloudhub_means_no_auth_and_no_hub_30(self):
        """A VirtualFleet has no CloudHub, and has to say so to be allowed none."""
        answers = ["7", "yes", "no", "1", "1", "", "wifipass", "no"]
        answers += settings_answers(ALL_GROUPS, {})
        answers += ["yes", "", "1"] + settings_answers({"ALL", "BOT"}, {}) + ["no"]
        answers += node_answers([1], [1])
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(list(cfg.hubs), [1])
        self.assertFalse(cfg.HasField("cloudhub"))
        self.assertFalse(cfg.HasField("comms"))
        # an override set whose answers all match the common ones writes nothing
        self.assertEqual(len(cfg.override), 0)

    def test_back_returns_to_the_previous_question(self):
        back = fc.SCRIPTED_BACK
        answers = [
            "8", back, "7",          # fleet id, then back from the fleet type question
            "yes", back, "no",       # fleet type: simulation, back, then real
            "yes",                   # and it has a CloudHub
            "1", "2",                # physical hubs, bots
            back,                    # from the permanent keys, back past key generation to bots
            "1, 2",                  # bots again
            "", "wifipass", "yes",   # permanent keys, wlan password, service vpn
            "<default>", "admin@example.com", "<default>", "<default>", "<default>",
        ]
        # back from the second settings question returns to the first, re-answered here
        first = [q for q in SCHEMA.questions if not q.identity][0]
        answers += [first.default, back, "hub_led"]
        answers += settings_answers(ALL_GROUPS, {"comms_links": "xbee"})[1:]
        answers += ["no"] + node_answers([1, 30], [1, 2])
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual((cfg.fleet, list(cfg.hubs), list(cfg.bots)), (7, [1, 30], [1, 2]))
        self.assertEqual(SCHEMA.questions_by_name["comms_links"].to_debconf(list(cfg.settings.comms_links)), "xbee")
        self.assertEqual(SCHEMA.questions_by_name[first.name].to_debconf(getattr(cfg.settings, first.name)), "hub_led")
        self.assertEqual(fc.validate(SCHEMA, cfg), [])

    def test_turning_the_cloudhub_off_drops_its_auth(self):
        back = fc.SCRIPTED_BACK
        # back from the CloudHub authentication all the way to the CloudHub question,
        # answered no the second time round
        answers = ["7", "yes", "yes", "1", "1", "", "wifipass", "no"] + [back] * 6
        answers += ["no", "1", "1", "", "wifipass", "no"]
        answers += settings_answers(ALL_GROUPS, {}) + ["no"] + node_answers([1], [1])
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(list(cfg.hubs), [1])
        self.assertFalse(cfg.HasField("cloudhub"))

    def test_back_out_of_the_first_question_writes_nothing(self):
        result, out = self.run_create([fc.SCRIPTED_BACK])
        self.assertEqual(result.returncode, 1)
        self.assertIn("Cancelled", result.stderr)
        self.assertFalse(os.path.exists(out))

    def test_rf_encryption_password_is_proposed_at_random(self):
        class AcceptDefault:
            def inputbox(self, text, default=""):
                return default
        q = SCHEMA.questions_by_name["rf_encryption_password"]
        first, second = fc.ask_question(AcceptDefault(), q, ""), fc.ask_question(AcceptDefault(), q, "")
        self.assertRegex(first, "^[0-9a-f]{32}$")
        self.assertNotEqual(first, second)
        self.assertEqual(fc.ask_question(AcceptDefault(), q, "keep"), "keep")

    def test_edit_keeps_everything_when_every_answer_is_accepted(self):
        """Accepting every prefilled answer rewrites the same configuration."""
        before = fc.load_migrated(SCHEMA, fixture("v1_fleet7.cfg"), echo=lambda _: None)
        out = os.path.join(self.env.dir, "edited.cfg")
        shutil.copyfile(fixture("v1_fleet7.cfg"), out)
        override = fc.node_settings_for(SCHEMA, before, "bot", 2)
        answers = ["<default>"] * 5                 # fleet, type, cloudhub, hubs, bots
        answers += ["<default>", ""]                # keep the permanent key, then no more
        answers += ["<default>"] * 2                # wlan password, service vpn
        answers += ["<default>"] * 5                # cloudhub auth
        answers += accept(before.settings)
        answers += ["<default>", "<default>"] + accept(override, {"ALL", "BOT"})  # the existing override set
        answers += ["no"] + node_answers([1, 30], [1, 2])
        result, _ = self.run_edit(out, answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        after = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(fc.validate(SCHEMA, after), [])
        self.assertEqual((after.fleet, list(after.hubs), list(after.bots)),
                         (before.fleet, list(before.hubs), list(before.bots)))
        self.assertEqual(after.settings, before.settings)
        self.assertEqual(list(after.override), list(before.override))
        self.assertEqual(list(after.ssh.permanent_authorized_keys), list(before.ssh.permanent_authorized_keys))
        # the Yubikey is not asked for again: the keys in the file are kept
        self.assertEqual([(k.id, k.public_key) for k in after.ssh.hub],
                         [(k.id, k.public_key) for k in before.ssh.hub])
        self.assertEqual(after.ssh.vpn_tmp.private_key, before.ssh.vpn_tmp.private_key)

    def test_edit_repairs_a_config_that_does_not_migrate(self):
        out = os.path.join(self.env.dir, "bad.cfg")
        shutil.copyfile(fixture("v1_bad_values.cfg"), out)
        loaded = SCHEMA.NodeSettings()
        fc.fill_defaults(SCHEMA, loaded)
        # a 2.y fleet without hub 30 stays without a CloudHub, so no CloudHub questions follow
        answers = ["<default>"] * 5 + ["", "<default>", "<default>"]
        answers += settings_answers(ALL_GROUPS, {"bot_type": "bio"})
        answers += ["no"] + node_answers([1], [1])
        result, _ = self.run_edit(out, answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        # the answers it could not carry over are named before the questions start
        self.assertIn("not carried over", result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        self.assertEqual(cfg.version, SCHEMA.version)
        self.assertEqual(SCHEMA.questions_by_name["bot_type"].to_debconf(cfg.settings.bot_type), "bio")

    def test_edit_adds_a_bot_and_keeps_the_existing_hub_keys(self):
        out = os.path.join(self.env.dir, "grow.cfg")
        shutil.copyfile(fixture("v1_fleet7.cfg"), out)
        before = fc.load_migrated(SCHEMA, fixture("v1_fleet7.cfg"), echo=lambda _: None)
        override = fc.node_settings_for(SCHEMA, before, "bot", 2)
        answers = ["<default>"] * 4 + ["1, 2, 3"]
        answers += ["<default>", ""] + ["<default>"] * 2 + ["<default>"] * 5
        answers += accept(before.settings)
        answers += ["<default>", "<default>"] + accept(override, {"ALL", "BOT"}) + ["no"]
        answers += node_answers([1, 30], [1, 2, 3])
        result, _ = self.run_edit(out, answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(list(cfg.bots), [1, 2, 3])
        self.assertEqual({k.id for k in cfg.ssh.hub}, {1, 30})
        self.assertTrue(all(k.public_key.startswith(("no-touch-required sk-ssh", "ssh-ed25519 AAAAhub30"))
                            for k in cfg.ssh.hub))

    def test_per_node_answers_are_asked_once_per_node_and_kept_by_edit(self):
        out = os.path.join(self.env.dir, "serials.cfg")
        shutil.copyfile(fixture("v1_fleet7.cfg"), out)
        before = fc.load_migrated(SCHEMA, fixture("v1_fleet7.cfg"), echo=lambda _: None)
        override = fc.node_settings_for(SCHEMA, before, "bot", 2)
        common = ["<default>"] * 4 + ["<default>", ""] + ["<default>"] * 2 + ["<default>"] * 5
        tail = ["<default>", "<default>"] + accept(override, {"ALL", "BOT"}) + ["no"]

        # hub 1 and hub 30 are not asked: neither question applies to a hub
        answers = common + accept(before.settings) + tail + ["VIN-A", "TAIL-A", "VIN-B", "TAIL-B"]
        result, _ = self.run_edit(out, answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        by_node = {(fc.node_type_name(SCHEMA, o.type), o.id): o.settings for o in cfg.override}
        self.assertEqual((by_node[("bot", 1)].bot_vin, by_node[("bot", 1)].tail_serial_number), ("VIN-A", "TAIL-A"))
        self.assertEqual((by_node[("bot", 2)].bot_vin, by_node[("bot", 2)].tail_serial_number), ("VIN-B", "TAIL-B"))
        self.assertFalse(cfg.settings.HasField("bot_vin"))

        # editing again offers each node its own answer back
        answers = common + accept(before.settings) + tail + ["<default>", "<default>", "VIN-C", "<default>"]
        result, _ = self.run_edit(out, answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        by_node = {(fc.node_type_name(SCHEMA, o.type), o.id): o.settings for o in cfg.override}
        self.assertEqual(by_node[("bot", 1)].bot_vin, "VIN-A")
        self.assertEqual((by_node[("bot", 2)].bot_vin, by_node[("bot", 2)].tail_serial_number), ("VIN-C", "TAIL-B"))

    def test_per_node_answer_in_the_common_settings_is_refused(self):
        cfg = fc.load_migrated(SCHEMA, fixture("v1_fleet7.cfg"), echo=lambda _: None)
        cfg.settings.bot_vin = "shared-by-every-bot"
        problems = fc.validate(SCHEMA, cfg)
        self.assertTrue(any("bot_vin" in p and "different on every node" in p for p in problems), problems)

    def test_edit_writes_elsewhere_with_output(self):
        src = os.path.join(self.env.dir, "src.cfg")
        dst = os.path.join(self.env.dir, "dst.cfg")
        shutil.copyfile(fixture("v2_no_permanent_keys.cfg"), src)
        loaded = fc.parse_fleet_config(SCHEMA, fixture("v2_no_permanent_keys.cfg"))
        answers = ["<default>"] * 5 + [""]
        answers += ["<default>"] * 2 + ["<default>"] * 5
        answers += accept(loaded.settings) + ["no"] + node_answers([30], [1])
        path = os.path.join(self.env.dir, "answers.txt")
        with open(path, "w") as f:
            f.write("\n".join(answers) + "\n")
        result = self.env.run("edit", src, "-o", dst, "--answers", path)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual(open(src).read(), open(fixture("v2_no_permanent_keys.cfg")).read())
        self.assertEqual(fc.validate(SCHEMA, fc.parse_fleet_config(SCHEMA, dst)), [])

    def test_per_node_questions_name_the_node(self):
        """Answering a VIN is meaningless without knowing which bot it is for."""
        answers = ["7", "no", "yes", "1", "1, 2", "", "wifipass", "no",
                   "<default>", "admin@example.com", "<default>", "<default>", "<default>"]
        answers += settings_answers(ALL_GROUPS, {}) + ["no"]
        answers += node_answers([1, 30], [])          # hubs, then bot 1 runs out of answers
        result, _ = self.run_create(answers)
        self.assertEqual(result.returncode, 1)
        self.assertIn("no scripted answer for: bot 1: ", result.stderr)

    def test_nothing_written_when_answers_run_out(self):
        result, out = self.run_create(["7", "no", "yes", "1"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("no scripted answer", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()
