#!/usr/bin/env python3

import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
TOOL = os.path.join(SOURCE_DIR, "src", "sh", "fleet", "jaia-fleet-config.py")
PROTO = os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto")
MESSAGES_DIR = os.path.join(SOURCE_DIR, "src", "lib", "messages")
TEMPLATE = os.path.join(SOURCE_DIR, "rootfs", "customization", "includes.chroot", "etc", "jaiabot", "init", "first-boot.preseed.yml.j2")
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
            "jaia_ip": 'case "$*" in *gateway*) echo 10.23.7.1 ;; *) echo 10.23.7.100 ;; esac',
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
        return bootdir

    def cleanup(self):
        shutil.rmtree(self.dir)


class SchemaTest(unittest.TestCase):
    def test_enum_value_strings_follow_the_prefix_convention(self):
        q = SCHEMA.questions_by_name["additional_sensors"]
        self.assertEqual([v.value for v in q.enum_values], ["turner_c_flour", "aml", "ppk", "none"])
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


class MigrationFailureTest(unittest.TestCase):
    def test_unknown_and_invalid_values_are_reported_by_name(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_bad_values.cfg"))
        notes, problems = fc.migrate(SCHEMA, cfg)
        self.assertEqual(sorted(problems), sorted([
            "jaiabot-embedded/bot_type: 'sonar' is not one of hydro, pam, bio, none",
            "jaiabot-embedded/no_such_question: not a jaiabot-embedded question",
            "jaiabot-embedded/warp: '3' is not one of 1, 2, 5, 10, 20, 30, 40, 50",
        ]))

    def test_cloudhub_requires_auth(self):
        cfg = fc.parse_fleet_config(SCHEMA, fixture("v1_cloudhub_no_auth.cfg"))
        fc.migrate(SCHEMA, cfg)
        problems = fc.validate(SCHEMA, cfg)
        self.assertIn("cloudhub_auth: required when hub 30 (CloudHub) is in the fleet", problems)

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

    def test_validate_reports_migration(self):
        result = self.env.run("validate", fixture("v1_fleet7.cfg"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("migration to version 2 succeeds", result.stdout)

    def test_validate_fails_loudly(self):
        result = self.env.run("validate", fixture("v1_bad_values.cfg"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("no_such_question", result.stderr)
        self.assertIn("regenerate it with 'jaia admin fleet create'", result.stderr)

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
        if q.identity or q.group not in groups:
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


class CreateTest(unittest.TestCase):
    def setUp(self):
        self.env = Env()
        self.addCleanup(self.env.cleanup)

    def run_create(self, answers):
        path = os.path.join(self.env.dir, "answers.txt")
        with open(path, "w") as f:
            f.write("\n".join(answers) + "\n")
        out = os.path.join(self.env.dir, "fleet7.cfg")
        result = self.env.run("create", out, "--answers", path)
        return result, out

    def test_creates_a_valid_current_version_file(self):
        answers = [
            "abc", "7",                      # fleet id: re-asked until it is in range
            "1, 30", "1, 2",                 # hubs, bots
            "ssh-ed25519 AAAAperm me", "",   # permanent keys
            "wifipass", "yes",               # wlan password, service vpn
            "https://cloudhub.example.com", "admin@example.com", "smtp.example.com:587",
        ]
        answers += settings_answers({"ALL", "BOT", "HUB"}, {"comms_links": "xbee, iridium", "bot_type": "pam",
                                                           "pam_connection_type": "uart", "user_role": "advanced"})
        answers += ["yes", "", "2"] + settings_answers({"ALL", "BOT"}, {"comms_links": "xbee, iridium", "bot_type": "bio",
                                                                         "camera_positions": "outward"})
        answers += ["no"]
        answers += ["300234010753370", "300234010753371", "SBD_ROCKBLOCK", "rbuser", "rbpass"]
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("Output written to", result.stdout)

        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertEqual(fc.validate(SCHEMA, cfg), [])
        self.assertEqual((cfg.version, cfg.fleet, list(cfg.hubs), list(cfg.bots)), (SCHEMA.version, 7, [1, 30], [1, 2]))
        keys = {k.id: k for k in cfg.ssh.hub}
        self.assertEqual(keys[1].public_key, "no-touch-required ssh-ed25519-sk AAAAhub1_fleet7 hub1_fleet7")
        self.assertEqual(keys[30].public_key, "ssh-ed25519 AAAAhub30_fleet7 hub30_fleet7")
        self.assertEqual(keys[1].private_key, "PRIVATE hub1_fleet7\n")
        self.assertEqual(cfg.ssh.vpn_tmp.public_key, "ssh-ed25519 AAAAid_vpn_tmp id_vpn_tmp")
        self.assertEqual(list(cfg.ssh.permanent_authorized_keys), ["ssh-ed25519 AAAAperm me"])
        self.assertEqual((cfg.wlan_password, cfg.service_vpn_enabled), ("wifipass", True))
        self.assertEqual(cfg.cloudhub_auth.admin_email, "admin@example.com")

        s = cfg.settings
        q = SCHEMA.questions_by_name
        self.assertEqual(q["comms_links"].to_debconf(list(s.comms_links)), "xbee, iridium")
        self.assertEqual(q["bot_type"].to_debconf(s.bot_type), "pam")
        self.assertEqual(q["pam_connection_type"].to_debconf(s.pam_connection_type), "uart")
        self.assertEqual(q["user_role"].to_debconf(s.user_role), "advanced")
        # every question is answered, identity ones never
        for question in SCHEMA.questions:
            if question.identity:
                self.assertFalse(s.HasField(question.name))
            elif not question.repeated:
                self.assertTrue(s.HasField(question.name), question.name)

        self.assertEqual(len(cfg.override), 1)
        o = cfg.override[0]
        self.assertEqual((fc.node_type_name(SCHEMA, o.type), o.id), ("bot", 2))
        self.assertEqual(sorted(f.name for f, _ in o.settings.ListFields()), ["bot_type", "camera_positions", "pam_connection_type"])
        self.assertEqual(q["bot_type"].to_debconf(o.settings.bot_type), "bio")
        self.assertEqual(q["pam_connection_type"].to_debconf(o.settings.pam_connection_type), "none")

        sbd = cfg.comms.iridium_sbd
        self.assertEqual([(b.id, b.imei) for b in sbd.bot], [(1, "300234010753370"), (2, "300234010753371")])
        self.assertEqual((sbd.rockblock.username, sbd.rockblock.password), ("rbuser", "rbpass"))

        result = self.env.run("validate", out)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_no_iridium_no_comms_and_no_empty_override(self):
        answers = ["7", "1", "1", "", "wifipass", "no"]
        answers += settings_answers({"ALL", "BOT", "HUB"}, {})
        answers += ["yes", "", "1"] + settings_answers({"ALL", "BOT"}, {}) + ["no"]
        result, out = self.run_create(answers)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        cfg = fc.parse_fleet_config(SCHEMA, out)
        self.assertFalse(cfg.HasField("comms"))
        self.assertFalse(cfg.HasField("cloudhub_auth"))
        self.assertEqual(len(cfg.override), 0)

    def test_rf_encryption_password_is_proposed_at_random(self):
        class AcceptDefault:
            def inputbox(self, text, default=""):
                return default
        q = SCHEMA.questions_by_name["rf_encryption_password"]
        first, second = fc.ask_question(AcceptDefault(), q, ""), fc.ask_question(AcceptDefault(), q, "")
        self.assertRegex(first, "^[0-9a-f]{32}$")
        self.assertNotEqual(first, second)
        self.assertEqual(fc.ask_question(AcceptDefault(), q, "keep"), "keep")

    def test_nothing_written_when_answers_run_out(self):
        result, out = self.run_create(["7", "1"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("no scripted answer", result.stderr)
        self.assertFalse(os.path.exists(out))


if __name__ == "__main__":
    unittest.main()
