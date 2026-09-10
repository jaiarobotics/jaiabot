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
import subprocess
import sys

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
        self.enum_values = enum_values  # for enum fields, in declaration order

        self.repeated = field.label == FieldDescriptor.LABEL_REPEATED
        if field.type == FieldDescriptor.TYPE_ENUM:
            self.type = "multiselect" if self.repeated else "select"
            self.choices = [v.value for v in enum_values if not v.deprecated]
        elif field.type in (FieldDescriptor.TYPE_INT32, FieldDescriptor.TYPE_UINT32,
                            FieldDescriptor.TYPE_INT64, FieldDescriptor.TYPE_UINT64):
            self.type = "select"
            if d.HasField("range"):
                self.choices = [str(i) for i in range(d.range.min, d.range.max + 1)]
            else:
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
    import tempfile
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


def settings_from_selections(schema, lines, problems, notes):
    """debconf-set-selections lines -> NodeSettings (identity keys dropped)."""
    settings = schema.NodeSettings()
    for line in lines:
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t") if "\t" in line else line.split(None, 3)
        if len(parts) < 3:
            problems.append("cannot parse selection line: {}".format(line))
            continue
        key = parts[1]
        value = parts[3] if len(parts) > 3 else ""
        apply_selection(schema, settings, key, value, problems, notes)
    return settings


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
    if q.repeated:
        settings.ClearField(q.name)
        getattr(settings, q.name).extend(parsed)
    else:
        setattr(settings, q.name, parsed)


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
    # Every question is written out so the file is a complete record
    for q in schema.questions:
        if q.identity or q.default is None:
            continue
        if q.repeated:
            if not getattr(cfg.settings, q.name):
                getattr(cfg.settings, q.name).extend(q.from_debconf(q.default))
        elif not cfg.settings.HasField(q.name):
            setattr(cfg.settings, q.name, q.from_debconf(q.default))


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


def cmd_settings(schema, args):
    """debconf-set-selections file -> 'settings { ... }' text for jaia admin fleet create."""
    problems, notes = [], []
    with open(args.selections) as f:
        settings = settings_from_selections(schema, f, problems, notes)
    for note in notes:
        print("settings: " + note, file=sys.stderr)
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    if args.only_changed_from:
        with open(args.only_changed_from) as f:
            base = settings_from_selections(schema, f, [], [])
        for field, value in list(settings.ListFields()):
            if field.label == FieldDescriptor.LABEL_REPEATED:
                same = list(value) == list(getattr(base, field.name))
            else:
                same = base.HasField(field.name) and getattr(base, field.name) == value
            if same:
                settings.ClearField(field.name)
    body = text_format.MessageToString(settings)
    indent = " " * args.indent
    name = args.field_name
    print("{}{} {{".format(indent, name))
    for line in body.splitlines():
        print("{}  {}".format(indent, line))
    print("{}}}".format(indent))
    return 0


# --- generate: the first-boot files for one node ----------------------------

def render_template(template_path, context):
    import jinja2
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
           "--fleet_id", str(fleet), "--ip_version", "ipv4"]
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

    p = sub.add_parser("settings", help="Convert a debconf-set-selections file to a 'settings { }' block")
    p.add_argument("selections")
    p.add_argument("--only-changed-from", help="Selections file to diff against; only differing answers are output")
    p.add_argument("--field-name", default="settings", help="Name of the emitted block")
    p.add_argument("--indent", type=int, default=0)
    p.set_defaults(func=cmd_settings)

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
