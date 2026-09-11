#!/usr/bin/env python3
#
# Fleet configuration tool: parses, validates, migrates and renders fleet
# configuration files (text format jaiabot.protobuf.FleetConfig).
#
# Self-contained on purpose: during a major upgrade it runs from the new
# release's boot tarball on a hub or bot that still runs the previous release,
# so it uses only python3, python3-protobuf and python3-jinja2, and reads the
# schema from fleet_config.desc (a protobuf FileDescriptorSet) rather than
# generated bindings. See "Fleet configuration versioning" in
# page091_major_upgrade.md.

import argparse
import io
import json
import os
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile

from google.protobuf import descriptor_pb2, descriptor_pool, message_factory, text_format
from google.protobuf.descriptor import FieldDescriptor

FLEET_CONFIG_TYPE = "jaiabot.protobuf.FleetConfig"
NODE_SETTINGS_TYPE = "jaiabot.protobuf.NodeSettings"
DESCRIPTOR_SET_NAME = "fleet_config.desc"
CLOUDHUB_ID = 30

# Fields whose values never appear in output or error messages
SECRET_FIELDS = {"private_key", "password", "wlan_password", "rf_encryption_password",
                 "dccl_encryption_password"}

# Sentinel the first-boot template dereferences so that an older generator
# (which does not define it) fails instead of rendering blanks
TEMPLATE_SENTINEL = "requires_jaia_fleet_config_tool"


class FleetConfigError(Exception):
    pass


###############################################################################
# Schema: the descriptor set plus the jaia.debconf annotations
###############################################################################


def enum_value_prefix(enum_name):
    """CommsLink -> COMMS_LINK_"""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", enum_name).upper() + "_"


class EnumValue:
    def __init__(self, descriptor, options):
        self.name = descriptor.name
        self.number = descriptor.number
        self.deprecated = descriptor.GetOptions().deprecated
        debconf = options.debconf
        prefix = enum_value_prefix(descriptor.type.name)
        if debconf.HasField("value"):
            self.value = debconf.value
        elif descriptor.name.startswith(prefix):
            self.value = descriptor.name[len(prefix):].lower()
        else:
            self.value = descriptor.name.lower()
        self.replaced_by = debconf.replaced_by if debconf.HasField("replaced_by") else None


class Question:
    """One NodeSettings field as debconf asks it."""

    def __init__(self, package, field, options, enum_values):
        self.field = field
        self.name = field.name
        self.key = "{}/{}".format(package, field.name)
        d = options.debconf
        self.group = d.DESCRIPTOR.fields_by_name["group"].enum_type.values_by_number[d.group].name
        self.identity = d.identity
        self.priority = d.DESCRIPTOR.fields_by_name["priority"].enum_type.values_by_number[d.priority].name
        self.description = d.description
        self.extended_description = d.extended_description
        self.ask_if = (d.ask_if.field, d.ask_if.equals) if d.HasField("ask_if") else None
        self.unasked_value = d.unasked_value if d.HasField("unasked_value") else None
        self.bounded_id = d.bounded_id
        self.enum_values = enum_values  # for enum fields, in declaration order

        self.repeated = field.label == FieldDescriptor.LABEL_REPEATED
        if field.type == FieldDescriptor.TYPE_ENUM:
            self.type = "multiselect" if self.repeated else "select"
            self.choices = [v.value for v in enum_values if not v.deprecated]
        elif field.type in (FieldDescriptor.TYPE_INT32, FieldDescriptor.TYPE_UINT32,
                            FieldDescriptor.TYPE_INT64, FieldDescriptor.TYPE_UINT64):
            if self.bounded_id:
                self.type = "string"
                self.choices = None
            else:
                self.type = "select"
                self.choices = list(d.choices)
        elif field.type == FieldDescriptor.TYPE_STRING:
            self.type = "string"
            self.choices = None
        elif field.type == FieldDescriptor.TYPE_BOOL:
            self.type = "boolean"
            self.choices = None
        else:
            raise FleetConfigError("unsupported field type for debconf question {}".format(self.key))

        if d.HasField("default"):
            self.default = d.default
        elif field.has_default_value:
            self.default = self.to_debconf(field.default_value)
        else:
            self.default = None

    def to_debconf(self, value):
        """Field value (enum number, list, int, str) -> debconf value string."""
        if self.field.type == FieldDescriptor.TYPE_ENUM:
            by_number = {v.number: v.value for v in self.enum_values}
            if self.repeated:
                return ", ".join(by_number[v] for v in value)
            return by_number[value]
        if self.field.type == FieldDescriptor.TYPE_BOOL:
            return "true" if value else "false"
        return str(value)

    def from_debconf(self, text):
        """debconf value string -> field value; raises FleetConfigError."""
        if self.field.type == FieldDescriptor.TYPE_ENUM:
            by_value = {v.value: v for v in self.enum_values}
            parts = [p.strip() for p in text.split(",")] if self.repeated else [text.strip()]
            numbers = []
            for part in parts:
                if part == "" and self.repeated:
                    continue
                ev = by_value.get(part)
                if ev is None:
                    raise FleetConfigError("{}: '{}' is not one of {}".format(self.key, part, ", ".join(self.choices)))
                if ev.deprecated:
                    if ev.replaced_by is None:
                        raise FleetConfigError("{}: '{}' is no longer supported".format(self.key, part))
                    ev = by_value[ev.replaced_by]
                numbers.append(ev.number)
            return numbers if self.repeated else numbers[0]
        if self.field.type == FieldDescriptor.TYPE_STRING:
            return text
        if self.field.type == FieldDescriptor.TYPE_BOOL:
            return text.strip().lower() == "true"
        text = text.strip()
        if self.choices is not None and text not in self.choices:
            raise FleetConfigError("{}: '{}' is not one of {}".format(self.key, text, collapse(self.choices)))
        if not text.isdigit():
            raise FleetConfigError("{}: '{}' is not a whole number".format(self.key, text))
        return int(text)

    def check_value(self, value):
        """Validate a field value already in the message; returns a problem or None."""
        if self.field.type == FieldDescriptor.TYPE_ENUM:
            values = value if self.repeated else [value]
            for v in values:
                ev = [e for e in self.enum_values if e.number == v][0]
                if ev.deprecated:
                    return "{}: {} is deprecated{}".format(
                        self.key, ev.name, " (migrate to get {})".format(ev.replaced_by) if ev.replaced_by else "")
        elif self.choices is not None and str(value) not in self.choices:
            return "{}: {} is not one of {}".format(self.key, value, collapse(self.choices))
        return None


def collapse(choices):
    if len(choices) > 8 and all(c.lstrip("-").isdigit() for c in choices):
        return "{}-{}".format(choices[0], choices[-1])
    return ", ".join(choices)


class Schema:
    def __init__(self, descriptor_set_bytes):
        fds = descriptor_pb2.FileDescriptorSet.FromString(descriptor_set_bytes)
        # A private pool, so several schema versions can be loaded side by side
        # (the contract checker does) and the jaia.* options are parsed without
        # generated bindings
        self.pool = descriptor_pool.DescriptorPool()
        for file in fds.file:
            self.pool.AddSerializedFile(file.SerializeToString())
        self.factory = message_factory.MessageFactory(self.pool)
        # Build every class up front: parsing an option extension needs the
        # class of the extension's message type to exist already
        file_names = [f.name for f in fds.file]
        if hasattr(message_factory, "GetMessageClassesForFiles"):
            message_factory.GetMessageClassesForFiles(file_names, self.pool)
        else:
            self.factory.GetMessages(file_names)
        self.FleetConfig = self.message_class(FLEET_CONFIG_TYPE)
        try:
            self.NodeSettings = self.message_class(NODE_SETTINGS_TYPE)
        except KeyError:
            self.NodeSettings = None

        file_desc = self.FleetConfig.DESCRIPTOR.file
        self.version = self._ext(file_desc.GetOptions(), "google.protobuf.FileOptions", "jaia.file").fleet_config_version
        if not self.version:
            raise FleetConfigError("fleet_config.proto declares no (jaia.file).fleet_config_version")

        self.questions = []
        self.package = None
        self.node_type_field = None
        if self.NodeSettings is not None:
            desc = self.NodeSettings.DESCRIPTOR
            msg_opts = self._ext(desc.GetOptions(), "google.protobuf.MessageOptions", "jaia.msg").debconf
            self.package = msg_opts.package
            self.node_type_field = msg_opts.node_type_field
            for field in desc.fields:
                opts = self._ext(field.GetOptions(), "google.protobuf.FieldOptions", "jaia.field")
                if not opts.HasField("debconf"):
                    continue
                enum_values = []
                if field.type == FieldDescriptor.TYPE_ENUM:
                    for ev in field.enum_type.values:
                        ev_opts = self._ext(ev.GetOptions(), "google.protobuf.EnumValueOptions", "jaia.ev")
                        enum_values.append(EnumValue(ev, ev_opts))
                self.questions.append(Question(self.package, field, opts, enum_values))
        self.questions_by_key = {q.key: q for q in self.questions}
        self.questions_by_name = {q.name: q for q in self.questions}

    def message_class(self, full_name):
        desc = self.pool.FindMessageTypeByName(full_name)
        if hasattr(message_factory, "GetMessageClass"):
            cls = message_factory.GetMessageClass(desc)
        else:
            cls = self.factory.GetPrototype(desc)
        # Older runtimes only parse extensions registered on the class
        if hasattr(cls, "RegisterExtension"):
            for ext in self.pool.FindAllExtensions(desc):
                try:
                    cls.RegisterExtension(ext)
                except Exception:
                    pass
        return cls

    def _ext(self, options, options_type, ext_name):
        cls = self.message_class(options_type)
        parsed = cls.FromString(options.SerializeToString())
        return parsed.Extensions[self.pool.FindExtensionByName(ext_name)]

    def group_questions(self, group):
        return [q for q in self.questions if q.group == group]


def find_descriptor_set(explicit=None):
    candidates = [explicit] if explicit else []
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates += [
        os.path.join(script_dir, DESCRIPTOR_SET_NAME),
        os.path.join(script_dir, "..", "share", "jaiabot", "fleet_config", DESCRIPTOR_SET_NAME),
        os.path.join("/usr/share/jaiabot/fleet_config", DESCRIPTOR_SET_NAME),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    raise FleetConfigError("{} not found (looked in {})".format(DESCRIPTOR_SET_NAME, ", ".join(candidates)))


def load_schema(descriptor_set=None):
    with open(find_descriptor_set(descriptor_set), "rb") as f:
        return Schema(f.read())


def compile_descriptor_set(proto, includes, protoc="protoc"):
    """Build-time helper: fleet_config.proto -> FileDescriptorSet bytes."""
    proto = os.path.abspath(proto)
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, DESCRIPTOR_SET_NAME)
        cmd = [protoc, "--descriptor_set_out=" + out, "--include_imports"]
        for include in includes or [os.path.dirname(proto)]:
            cmd.append("-I" + os.path.abspath(include))
        cmd.append(proto)
        subprocess.run(cmd, check=True)
        with open(out, "rb") as f:
            return f.read()


###############################################################################
# Fleet config files
###############################################################################


def parse_fleet_config(schema, path):
    cfg = schema.FleetConfig()
    with open(path) as f:
        try:
            text_format.Parse(f.read(), cfg)
        except text_format.ParseError as e:
            raise FleetConfigError("{}: {}".format(path, e))
    if cfg.version > schema.version:
        raise FleetConfigError(
            "{} is fleet config version {}, which is newer than this software supports (version {}). "
            "Use the newer release's tools with this fleet.".format(path, cfg.version, schema.version))
    return cfg


def fleet_config_text(cfg):
    # version first, where a reader looks for it
    body = type(cfg)()
    body.CopyFrom(cfg)
    body.ClearField("version")
    return "version: {}\n{}".format(cfg.version, text_format.MessageToString(body))


def node_type_name(schema, cfg_node_type):
    """FleetConfig.DebconfOverride.NodeType number -> 'bot'/'hub'"""
    enum = schema.FleetConfig.DESCRIPTOR.enum_types_by_name.get("NodeType") or \
        schema.pool.FindEnumTypeByName(FLEET_CONFIG_TYPE + ".DebconfOverride.NodeType")
    return enum.values_by_number[cfg_node_type].name.lower()


def node_settings_for(schema, cfg, node_type, node_id):
    """Common settings with this node's override applied field by field."""
    merged = schema.NodeSettings()
    if cfg.HasField("settings"):
        merged.CopyFrom(cfg.settings)
    for override in cfg.override:
        if node_type_name(schema, override.type) == node_type and override.id == node_id:
            for field, value in override.settings.ListFields():
                if field.label == FieldDescriptor.LABEL_REPEATED:
                    merged.ClearField(field.name)
                    getattr(merged, field.name).extend(value)
                else:
                    setattr(merged, field.name, value)
    return merged


def debconf_selections(schema, settings, include_identity=False):
    """[{key, type, value}] for every question, explicit defaults included."""
    out = []
    for q in schema.questions:
        if q.identity and not include_identity:
            continue
        if q.repeated:
            values = list(getattr(settings, q.name))
            value = q.to_debconf(values) if values else q.default
        elif settings.HasField(q.name):
            value = q.to_debconf(getattr(settings, q.name))
        else:
            value = q.default
        if value is None:
            continue
        out.append({"key": q.key, "type": q.type.upper(), "value": value})
    return out


def apply_selection(schema, settings, key, value, problems, notes):
    q = schema.questions_by_key.get(key)
    if q is None:
        if key.startswith(schema.package + "/debconf_state_"):
            return
        problems.append("{}: not a jaiabot-embedded question".format(key))
        return
    if q.identity:
        notes.append("{}: dropped (identity is set per node)".format(key))
        return
    try:
        parsed = q.from_debconf(value)
    except FleetConfigError as e:
        problems.append(str(e))
        return
    set_answer(settings, q, parsed)


###############################################################################
# Migrations: one step per version, applied in order
###############################################################################


def migrate_1_to_2(schema, cfg, notes, problems):
    """String debconf answers become typed NodeSettings."""
    if cfg.debconf:
        for d in cfg.debconf:
            apply_selection(schema, cfg.settings, d.key, d.value, problems, notes)
        notes.append("debconf: {} answers converted to settings".format(len(cfg.debconf)))
    for old in cfg.debconf_override:
        new = cfg.override.add()
        new.type = old.type
        new.id = old.id
        for d in old.debconf:
            apply_selection(schema, new.settings, d.key, d.value, problems, notes)
        notes.append("debconf_override {} {}: converted".format(node_type_name(schema, old.type), old.id))
    cfg.ClearField("debconf")
    cfg.ClearField("debconf_override")
    if not cfg.HasField("settings"):
        cfg.settings.SetInParent()
    fill_defaults(schema, cfg.settings)


def fill_defaults(schema, settings):
    """Every unanswered question at its default, so the file is a complete record."""
    for q in schema.questions:
        if q.identity or q.default is None:
            continue
        if q.repeated:
            if not getattr(settings, q.name):
                getattr(settings, q.name).extend(q.from_debconf(q.default))
        elif not settings.HasField(q.name):
            setattr(settings, q.name, q.from_debconf(q.default))


def set_answer(settings, q, parsed):
    if q.repeated:
        settings.ClearField(q.name)
        getattr(settings, q.name).extend(parsed)
    else:
        setattr(settings, q.name, parsed)


MIGRATIONS = {
    1: migrate_1_to_2,
}


def migrate(schema, cfg):
    """Returns (notes, problems); cfg is migrated in place up to schema.version."""
    notes, problems = [], []
    version = cfg.version
    while version < schema.version:
        step = MIGRATIONS.get(version)
        if step is None:
            raise FleetConfigError("no migration from fleet config version {} to {}".format(version, version + 1))
        step(schema, cfg, notes, problems)
        version += 1
        notes.append("migrated to version {}".format(version))
    cfg.version = schema.version
    return notes, problems


###############################################################################
# Validation of a current-version config
###############################################################################


def validate(schema, cfg):
    problems = []
    if cfg.version != schema.version:
        problems.append("version {} is not the current version {} (run migrate)".format(cfg.version, schema.version))
    if not cfg.IsInitialized():
        for field in cfg.FindInitializationErrors():
            problems.append("missing required field {}".format(field))
    if cfg.debconf or cfg.debconf_override:
        problems.append("debconf/debconf_override are version 1 fields (run migrate)")

    def check_settings(settings, where):
        for q in schema.questions:
            if q.repeated:
                if not getattr(settings, q.name):
                    continue
                value = list(getattr(settings, q.name))
            elif settings.HasField(q.name):
                value = getattr(settings, q.name)
            else:
                continue
            if q.identity:
                problems.append("{}: {} is set per node and must not be in {}".format(where, q.name, where))
                continue
            problem = q.check_value(value)
            if problem:
                problems.append("{}: {}".format(where, problem))

    if cfg.HasField("settings"):
        check_settings(cfg.settings, "settings")
    for override in cfg.override:
        node = node_type_name(schema, override.type)
        ids = cfg.hubs if node == "hub" else cfg.bots
        where = "override {} {}".format(node, override.id)
        if override.id not in ids:
            problems.append("{}: not in this fleet's {}s".format(where, node))
        check_settings(override.settings, where)

    hub_keys = {k.id for k in cfg.ssh.hub}
    for hub in cfg.hubs:
        if hub not in hub_keys:
            problems.append("ssh: no hub key for hub {}".format(hub))
    if CLOUDHUB_ID in cfg.hubs:
        if not cfg.HasField("cloudhub_auth"):
            problems.append("cloudhub_auth: required when hub {} (CloudHub) is in the fleet".format(CLOUDHUB_ID))
        else:
            for name in ("base_uri", "admin_email", "smtp_address"):
                if not getattr(cfg.cloudhub_auth, name):
                    problems.append("cloudhub_auth.{}: must be set".format(name))
    return problems


def load_migrated(schema, path, echo=print):
    """Parse, migrate in memory and validate; raises on any problem."""
    cfg = parse_fleet_config(schema, path)
    if cfg.version < schema.version:
        notes, problems = migrate(schema, cfg)
        for note in notes:
            echo("migrate: " + note)
        if problems:
            raise FleetConfigError(problem_report(path, problems))
    problems = validate(schema, cfg)
    if problems:
        raise FleetConfigError(problem_report(path, problems))
    return cfg


def problem_report(path, problems):
    return "{} cannot be used with this release:\n  {}\n{}".format(
        path, "\n  ".join(problems),
        "Fix the fleet configuration, or regenerate it with 'jaia admin fleet create'.")


###############################################################################
# Commands
###############################################################################


def cmd_version(schema, args):
    print(schema.version)
    return 0


def cmd_validate(schema, args):
    cfg = parse_fleet_config(schema, args.fleetcfg)
    print("{}: fleet config version {} (current is {})".format(args.fleetcfg, cfg.version, schema.version))
    if cfg.version < schema.version:
        notes, problems = migrate(schema, cfg)
        for note in notes:
            print("migrate: " + note)
        if problems:
            print(problem_report(args.fleetcfg, problems), file=sys.stderr)
            return 1
        print("migration to version {} succeeds; write it with 'jaia admin fleet migrate'".format(schema.version))
    problems = validate(schema, cfg)
    if problems:
        print(problem_report(args.fleetcfg, problems), file=sys.stderr)
        return 1
    print("{}: valid".format(args.fleetcfg))
    return 0


def cmd_migrate(schema, args):
    cfg = parse_fleet_config(schema, args.fleetcfg)
    if cfg.version == schema.version:
        print("{}: already version {}".format(args.fleetcfg, schema.version))
    notes, problems = migrate(schema, cfg)
    for note in notes:
        print("migrate: " + note)
    problems += validate(schema, cfg)
    if problems:
        print(problem_report(args.fleetcfg, problems), file=sys.stderr)
        return 1
    if args.check:
        print("{}: migration to version {} succeeds".format(args.fleetcfg, schema.version))
        return 0
    out = args.output or args.fleetcfg
    with open(out, "w") as f:
        f.write(fleet_config_text(cfg))
    print("wrote {} (version {})".format(out, schema.version))
    return 0


# --- generate: the first-boot files for one node ----------------------------

def render_template(template_path, context):
    try:
        import jinja2
    except ImportError:
        raise FleetConfigError("python3-jinja2 is required to generate first boot files")
    with open(template_path) as f:
        template = jinja2.Template(f.read(), undefined=jinja2.StrictUndefined)
    return template.render(context)


def find_partition_by_label(label):
    label_path = "/dev/disk/by-label/{}".format(label)
    if os.path.exists(label_path):
        return os.path.realpath(label_path)
    return None


def get_mount_point(partition):
    with open("/proc/mounts") as mounts:
        for line in mounts:
            parts = line.split()
            if parts and parts[0] == partition:
                return parts[1]
    return None


def find_bootdir(label):
    partition = find_partition_by_label(label)
    if not partition:
        return None
    print("Found partition ({}) for LABEL={}".format(partition, label))
    mount_point = get_mount_point(partition)
    if not mount_point:
        raise FleetConfigError("Partition '{}' exists but is not mounted. Please mount this disk before proceeding".format(label))
    return mount_point


def jaia_ip(query_type, node_type, fleet, node_id=None):
    cmd = ["jaia_ip", "--query_type", query_type, "--node_type", node_type, "--ip_net", "wlan",
           "--fleet_id", str(fleet)]
    if node_id is not None:
        cmd += ["--node_id", str(node_id)]
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()


def cmd_generate(schema, args):
    cfg = load_migrated(schema, args.fleetcfg)

    node_type = "bot" if args.type == "rpicam" else args.type
    ids = cfg.hubs if node_type == "hub" else cfg.bots
    if args.id not in ids:
        raise FleetConfigError("{} {} not included in {}".format(node_type, args.id, args.fleetcfg))

    actions = args.action
    if args.hub_ssh_keys_only:
        actions = ["hub_ssh_keys"]
    elif not actions:
        actions = ["hub_ssh_keys", "vpn_key", "first_boot", "store_fleet_cfg"]
    print("Running actions: {}".format(actions))

    bootdir = args.bootdir
    if bootdir is None:
        for label in ("boot", "bootfs"):
            bootdir = find_bootdir(label)
            if bootdir:
                print("Using {} for --bootdir based on mount point of LABEL={}".format(bootdir, label))
                break
    if bootdir is None:
        raise FleetConfigError("No partition with label 'boot' or 'bootfs' found. Please insert and mount disk or provide --bootdir")

    settings = node_settings_for(schema, cfg, node_type, args.id)
    context = json.loads(json_format_message(cfg))
    context["debconf"] = debconf_selections(schema, settings)
    context["this"] = {
        "type": args.type,
        "id": args.id,
        "mode": args.mode,
        "ip": jaia_ip("addr", args.type, cfg.fleet, args.id),
        "gateway_ip": jaia_ip("addr", "gateway", cfg.fleet),
    }
    context[TEMPLATE_SENTINEL] = {"v{}".format(v): "" for v in range(1, schema.version + 1)}

    init_dir = os.path.join(bootdir, "jaiabot", "init")

    if "first_boot" in actions:
        template_file = os.path.join(init_dir, "first-boot.preseed.yml.j2")
        rendered = render_template(template_file, context)
        preseed_yml = os.path.join(init_dir, "first-boot.preseed.yml")
        with open(preseed_yml, "w") as f:
            f.write(rendered)
        print("Wrote cloud-init file: {}".format(preseed_yml))

    if "new_hub_script" in actions:
        template_file = os.path.join(bootdir, "new_hub.sh.j2")
        rendered = render_template(template_file, context)
        new_hub_script = os.path.join(bootdir, "new_hub.sh")
        with open(new_hub_script, "w") as f:
            f.write(rendered)
        print("Wrote new hub script: {}".format(new_hub_script))

    if "vpn_key" in actions:
        if cfg.ssh.HasField("vpn_tmp"):
            vpn_key_priv = os.path.join(init_dir, "id_vpn_tmp")
            with open(vpn_key_priv, "w") as f:
                f.write(cfg.ssh.vpn_tmp.private_key)
            with open(vpn_key_priv + ".pub", "w") as f:
                f.write(cfg.ssh.vpn_tmp.public_key + "\n")
            print("Wrote SSH key pair: {} and {}.pub".format(vpn_key_priv, vpn_key_priv))
        else:
            print("WARNING: No vpn_tmp key provided")

        if cfg.HasField("comms") and cfg.comms.HasField("iridium_sbd"):
            iridium_cfg = os.path.join(init_dir, "iridium.json")
            with open(iridium_cfg, "w") as f:
                f.write(json_format_message(cfg.comms.iridium_sbd))

    if node_type == "hub":
        if "hub_ssh_keys" in actions:
            key_found = False
            for hub_key in cfg.ssh.hub:
                if hub_key.id == args.id:
                    hub_key_priv = os.path.join(init_dir, "hub{}_fleet{}".format(args.id, cfg.fleet))
                    with open(hub_key_priv, "w") as f:
                        f.write(hub_key.private_key)
                    with open(hub_key_priv + ".pub", "w") as f:
                        f.write(hub_key.public_key + "\n")
                    print("Wrote SSH key pair: {} and {}.pub".format(hub_key_priv, hub_key_priv))
                    key_found = True
            if not key_found:
                print("WARNING: No hub key provided for hub {}".format(args.id))

        if "store_fleet_cfg" in actions:
            # The migrated form, so the next upgrade starts from this version
            stored = os.path.join(init_dir, "fleet{}.cfg".format(cfg.fleet))
            with open(stored, "w") as f:
                f.write(fleet_config_text(cfg))
            print("Wrote fleet config: {}".format(stored))

        if "write_cloudhub_auth" in actions:
            if not cfg.HasField("cloudhub_auth"):
                raise FleetConfigError("cloudhub_auth is not set in {}".format(args.fleetcfg))
            cloudhub_auth_sh = os.path.join(init_dir, "cloudhub_auth.sh")
            with open(cloudhub_auth_sh, "w") as sh:
                sh.write("AUTH_BASE_URI={}\n".format(cfg.cloudhub_auth.base_uri))
                sh.write("AUTH_ADMIN_EMAIL={}\n".format(cfg.cloudhub_auth.admin_email))
                sh.write("AUTH_SMTP_ADDRESS={}\n".format(cfg.cloudhub_auth.smtp_address))
            print("Wrote cloudhub auth variables to: {}".format(cloudhub_auth_sh))

    if args.debug:
        print("Rendered context: {}".format(json.dumps(redacted(context), indent=2)))
    return 0


def json_format_message(msg):
    from google.protobuf import json_format
    return json_format.MessageToJson(msg)


def redacted(obj):
    if isinstance(obj, dict):
        return {k: ("<redacted>" if any(k.lower().startswith(s.replace("_", "")) or k == s for s in SECRET_FIELDS)
                    else redacted(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redacted(v) for v in obj]
    return obj


###############################################################################
# Command line
###############################################################################



# --- create: interactive fleet configuration ----------------------------------

DIALOG_TITLE = "Fleet Configuration"


class Cancelled(FleetConfigError):
    pass


class WhiptailUI:
    """Dialogs drawn with whiptail on the controlling terminal."""

    def __init__(self):
        self.tty = open("/dev/tty", "w")

    def _run(self, box, text, tail=(), options=(), cancel_ok=False):
        cols, lines = shutil.get_terminal_size((80, 24))
        cmd = ["whiptail", "--title", DIALOG_TITLE] + list(options) + [box, text, str(lines - 4), str(cols - 4)] + list(tail)
        result = subprocess.run(cmd, stdout=self.tty, stderr=subprocess.PIPE, text=True)
        if result.returncode == 1 and cancel_ok:
            return None
        if result.returncode != 0:
            raise Cancelled("cancelled")
        return result.stderr

    def _list_height(self, choices):
        return str(min(len(choices), max(shutil.get_terminal_size((80, 24)).lines - 12, 4)))

    def menu(self, text, choices, default=None):
        options = ["--default-item", default] if default is not None else []
        return self._run("--menu", text, [self._list_height(choices)] + [x for c in choices for x in (c, "")], options)

    def checklist(self, text, choices, checked=()):
        items = [x for c in choices for x in (c, "", "on" if c in checked else "off")]
        return shlex.split(self._run("--checklist", text, [self._list_height(choices)] + items))

    def inputbox(self, text, default=""):
        return self._run("--inputbox", text, [default]).strip()

    def yesno(self, text):
        return self._run("--yesno", text, cancel_ok=True) is not None

    def msgbox(self, text):
        self._run("--msgbox", text)


class ScriptedUI:
    """Answers read from a file, one per line and dialog: checklists comma-separated,
    yes/no as yes or no, an empty line for an empty answer."""

    def __init__(self, path):
        with open(path) as f:
            self.answers = [line.rstrip("\n") for line in f if not line.startswith("#")]

    def _next(self, text):
        if not self.answers:
            raise FleetConfigError("no scripted answer for: {}".format(text.splitlines()[0]))
        return self.answers.pop(0)

    def menu(self, text, choices, default=None):
        answer = self._next(text)
        if answer not in choices:
            raise FleetConfigError("scripted answer '{}' is not one of {}".format(answer, collapse(choices)))
        return answer

    def checklist(self, text, choices, checked=()):
        answer = self._next(text)
        return [a.strip() for a in answer.split(",") if a.strip()]

    def inputbox(self, text, default=""):
        return self._next(text)

    def yesno(self, text):
        return self._next(text).lower() == "yes"

    def msgbox(self, text):
        pass


def jaia_bounds(flag, end):
    try:
        out = subprocess.run(["jaia_bounds", "--" + flag, "--" + end], capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        raise FleetConfigError("jaia_bounds --{} failed ({}); is jaiabot-apps installed?".format(flag, e))
    return int(out.strip())


def ask_id(ui, name, text):
    lo, hi = jaia_bounds(name, "min"), jaia_bounds(name, "max")
    while True:
        answer = ui.inputbox("{} ({} to {})".format(text, lo, hi))
        if answer.isdigit() and lo <= int(answer) <= hi:
            return int(answer)
        ui.msgbox("'{}' is not a whole number from {} to {}".format(answer, lo, hi))


def ask_ids(ui, name, text):
    # 0 is the unassigned placeholder, never a node in a fleet
    lo, hi = max(jaia_bounds(name, "min"), 1), jaia_bounds(name, "max")
    return [int(x) for x in ui.checklist(text, [str(i) for i in range(lo, hi + 1)])]


def ssh_keygen(comment, security_key=False):
    """(private key file contents, public key line) for a fresh ed25519 key."""
    with tempfile.TemporaryDirectory() as tmp:
        private = os.path.join(tmp, comment)
        cmd = ["ssh-keygen", "-f", private, "-N", "", "-C", comment]
        if security_key:
            cmd += ["-t", "ed25519-sk", "-O", "no-touch-required"]
        else:
            cmd += ["-t", "ed25519"]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
        with open(private) as f:
            private_key = f.read()
        with open(private + ".pub") as f:
            public_key = f.read().strip()
    return private_key, public_key


def yubikey_present():
    try:
        out = subprocess.run(["ykman", "list", "-s"], capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        raise FleetConfigError("ykman failed ({}); is yubikey-manager installed?".format(e))
    return len(out.split()) == 1


def hub_key(ui, fleet, hub):
    comment = "hub{}_fleet{}".format(hub, fleet)
    if hub == CLOUDHUB_ID:
        # no USB port in the cloud, so a file key
        return ssh_keygen(comment)
    ui.msgbox("Hub {} SSH Private Key: insert the Yubikey for hub {} into a USB port to generate its SSH key, "
              "then press OK".format(hub, hub))
    while not yubikey_present():
        ui.msgbox("ERROR: exactly one Yubikey must be inserted. Check that the Yubikey for hub {} is connected "
                  "and no other Yubikey is.".format(hub))
    private_key, public_key = ssh_keygen(comment, security_key=True)
    return private_key, "no-touch-required " + public_key


# Answers proposed for questions whose default is empty
GENERATED_DEFAULTS = {"rf_encryption_password": lambda: secrets.token_hex(16)}


def current_answer(q, settings):
    """The debconf-form answer a question currently holds, or its default."""
    if q.identity:
        return q.default
    if q.repeated:
        values = list(getattr(settings, q.name))
        return q.to_debconf(values) if values else q.default
    if settings.HasField(q.name):
        return q.to_debconf(getattr(settings, q.name))
    return q.default


def ask_question(ui, q, current):
    text = q.description
    if q.extended_description:
        text += "\n\n" + q.extended_description
    if q.type == "select":
        return ui.menu(text, q.choices, default=current)
    if q.type == "multiselect":
        checked = [c.strip() for c in (current or "").split(",")]
        return ", ".join(ui.checklist(text, q.choices, checked=checked))
    if q.type == "boolean":
        return "true" if ui.yesno(text) else "false"
    if current in (None, "") and q.name in GENERATED_DEFAULTS:
        current = GENERATED_DEFAULTS[q.name]()
    return ui.inputbox(text, current or "")


def ask_settings(ui, schema, groups, base):
    """Ask every non-identity question of the given groups, starting from base's answers."""
    settings = schema.NodeSettings()
    settings.CopyFrom(base)
    for q in schema.questions:
        if q.identity or q.group not in groups:
            continue
        if q.ask_if:
            field, equals = q.ask_if
            if current_answer(schema.questions_by_name[field], settings) != equals:
                if q.unasked_value is not None:
                    set_answer(settings, q, q.from_debconf(q.unasked_value))
                continue
        while True:
            try:
                set_answer(settings, q, q.from_debconf(ask_question(ui, q, current_answer(q, settings))))
                break
            except FleetConfigError as e:
                ui.msgbox(str(e))
    return settings


def changed_fields(schema, settings, base):
    """The fields of settings whose value differs from base."""
    diff = schema.NodeSettings()
    for q in schema.questions:
        if q.identity:
            continue
        if current_answer(q, settings) != current_answer(q, base):
            set_answer(diff, q, q.from_debconf(current_answer(q, settings)))
    return diff


def uses_comms_link(schema, cfg, link):
    q = schema.questions_by_name["comms_links"]
    for settings in [cfg.settings] + [o.settings for o in cfg.override]:
        if link in [v.strip() for v in (current_answer(q, settings) or "").split(",")]:
            return True
    return False


def node_type_number(schema, name):
    enum = schema.pool.FindEnumTypeByName(FLEET_CONFIG_TYPE + ".DebconfOverride.NodeType")
    return enum.values_by_name[name.upper()].number


def create(schema, ui, banner=print):
    cfg = schema.FleetConfig()
    cfg.version = schema.version

    banner("Choose fleet")
    cfg.fleet = ask_id(ui, "fleet_id", "Which fleet to create?")
    banner("Choose hubs")
    cfg.hubs.extend(ask_ids(ui, "hub_id", "Which hubs are in the fleet?"))
    banner("Choose bots")
    cfg.bots.extend(ask_ids(ui, "bot_id", "Which bots are in the fleet?"))

    banner("Generating hub SSH keys")
    for hub in cfg.hubs:
        key = cfg.ssh.hub.add()
        key.id = hub
        key.private_key, key.public_key = hub_key(ui, cfg.fleet, hub)

    banner("Generating service Wireguard VPN temporary key")
    cfg.ssh.vpn_tmp.private_key, cfg.ssh.vpn_tmp.public_key = ssh_keygen("id_vpn_tmp")

    banner("Permanent SSH keys (for /home/jaia/.ssh/authorized_keys)")
    while True:
        key = ui.inputbox("Enter a permanent SSH public key (for /home/jaia/.ssh/authorized_keys). Leave blank to continue")
        if not key:
            break
        cfg.ssh.permanent_authorized_keys.append(key)

    banner("Wifi password")
    cfg.wlan_password = ui.inputbox("Enter the WIFI password")

    banner("Service Wireguard VPN")
    cfg.service_vpn_enabled = ui.yesno("Should the service Wireguard VPN be enabled at boot?")

    if CLOUDHUB_ID in cfg.hubs:
        banner("CloudHub authentication")
        cfg.cloudhub_auth.base_uri = ui.inputbox("CloudHub base URI (e.g. https://cloudhub.example.com)")
        cfg.cloudhub_auth.admin_email = ui.inputbox("CloudHub administrator email")
        cfg.cloudhub_auth.smtp_address = ui.inputbox("SMTP server for CloudHub login emails (host:port)")

    banner("Common jaiabot-embedded settings")
    defaults = schema.NodeSettings()
    fill_defaults(schema, defaults)
    cfg.settings.CopyFrom(ask_settings(ui, schema, {"ALL", "BOT", "HUB"}, defaults))

    banner("Overrides (settings that differ from the common ones)")
    while ui.yesno("Do you have any bot/hub specific settings that differ from the common ones?"):
        hubs = [int(x) for x in ui.checklist("Which hubs are in this override set?", [str(h) for h in cfg.hubs])]
        bots = [int(x) for x in ui.checklist("Which bots are in this override set?", [str(b) for b in cfg.bots])]
        groups = {"ALL"} | ({"HUB"} if hubs else set()) | ({"BOT"} if bots else set())
        answers = ask_settings(ui, schema, groups, cfg.settings)
        diff = changed_fields(schema, answers, cfg.settings)
        if not diff.ListFields():
            ui.msgbox("No setting differs from the common ones; no override written")
            continue
        for node_type, ids in (("hub", hubs), ("bot", bots)):
            for node_id in ids:
                override = cfg.override.add()
                override.type = node_type_number(schema, node_type)
                override.id = node_id
                override.settings.CopyFrom(diff)

    if uses_comms_link(schema, cfg, "iridium"):
        banner("Iridium SBD configuration")
        sbd = cfg.comms.iridium_sbd
        for bot in cfg.bots:
            entry = sbd.bot.add()
            entry.id = bot
            entry.imei = ui.inputbox("Enter the Iridium IMEI for bot {}".format(bot))
        sbd_types = sbd.DESCRIPTOR.fields_by_name["sbd_type"].enum_type
        sbd.sbd_type = sbd_types.values_by_name[
            ui.menu("Which Iridium shore service does this fleet use (MetOcean is SBD_DIRECTIP)?",
                    [v.name for v in sbd_types.values])].number
        if sbd_types.values_by_number[sbd.sbd_type].name == "SBD_ROCKBLOCK":
            sbd.rockblock.username = ui.inputbox("Enter the RockBLOCK portal username")
            sbd.rockblock.password = ui.inputbox("Enter the RockBLOCK portal password")

    problems = validate(schema, cfg)
    if problems:
        raise FleetConfigError("the new fleet configuration is not valid:\n  " + "\n  ".join(problems))
    return cfg


def cmd_create(schema, args):
    ui = ScriptedUI(args.answers) if args.answers else WhiptailUI()

    def banner(text):
        print("## " + text)

    try:
        cfg = create(schema, ui, banner)
    except Cancelled:
        print("Cancelled; nothing written", file=sys.stderr)
        return 1
    with open(args.fleetcfg, "w") as f:
        f.write(fleet_config_text(cfg))
    print("Output written to " + args.fleetcfg)
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="Jaiabot fleet configuration tool")
    parser.add_argument("--descriptor-set", help="fleet_config.desc to use (default: next to this script or in share/jaiabot/fleet_config)")
    parser.add_argument("--binary", help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("version", help="Print the fleet config version this tool writes")
    p.set_defaults(func=cmd_version)

    p = sub.add_parser("validate", help="Check a fleet config, including whether it can be migrated to the current version")
    p.add_argument("fleetcfg", help="Path to fleet configuration file (protobuf TextFormat version of FleetConfig)")
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("migrate", help="Rewrite a fleet config at the current version")
    p.add_argument("fleetcfg")
    p.add_argument("-o", "--output", help="Write here instead of in place")
    p.add_argument("--check", action="store_true", help="Report whether migration would succeed without writing")
    p.set_defaults(func=cmd_migrate)

    p = sub.add_parser("create", help="Interactively create a new fleet configuration")
    p.add_argument("fleetcfg", help="Path to write the fleet configuration file to")
    p.add_argument("--answers", help=argparse.SUPPRESS)
    p.set_defaults(func=cmd_create)

    p = sub.add_parser("generate", help="Generate first boot configuration and write to disk")
    p.add_argument("fleetcfg", help="Path to fleet configuration file (protobuf TextFormat version of FleetConfig)")
    p.add_argument("--bootdir", help="Path to boot directory (optional, if omitted the path to a mounted LABEL=boot partition will be used if found)")
    p.add_argument("--debug", help="Output debugging information", action="store_true")
    p.add_argument("--hub-ssh-keys-only", help="Only output the hub SSH keys (skip all other actions). Same as --action=hub_ssh_keys.", action="store_true")
    p.add_argument("--mode", default="runtime", choices=["runtime", "simulation"], help="Whether this is a real (runtime) or virtual (simulation) system")
    p.add_argument("--action", action="append",
                   choices=["hub_ssh_keys", "vpn_key", "first_boot", "store_fleet_cfg", "new_hub_script", "write_cloudhub_auth"],
                   help="Actions to take (default is ['hub_ssh_keys', 'vpn_key', 'first_boot', 'store_fleet_cfg'])")
    p.add_argument("type", choices=["bot", "hub", "rpicam"], help="Type of system to generate for")
    p.add_argument("id", type=int, help="ID of bot or hub")
    p.set_defaults(func=cmd_generate)
    return parser


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    # "jaia admin fleet <action>" runs this script as "<script> --binary=jaia admin fleet <action> args..."
    if argv and argv[0].startswith("--binary="):
        action = argv[0].split()[-1]
        argv = [action] + argv[1:]
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        schema = load_schema(args.descriptor_set)
        return args.func(schema, args)
    except FleetConfigError as e:
        print("ERROR: {}".format(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
