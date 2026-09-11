#!/usr/bin/env python3
#
# The fleet config "contract": everything a fleet configuration file (a
# jaiabot.protobuf.FleetConfig in text format) must conform to - the schema in
# fleet_config.proto together with the debconf questions it carries.
#
# One snapshot per fleet config version is committed under
# src/lib/messages/fleet_config/contract/vN/: a frozen copy of fleet_config.proto
# (and, for versions whose questions were still a hand-written templates file,
# of debian/jaiabot-embedded.templates). 'check' compiles the current proto and
# the snapshot for the version it declares and classifies the differences:
# compatible changes need the snapshot refreshed ('write'), breaking ones need a
# version bump and a migration, and a few edits (deleting a field) are refused
# because older files would stop parsing.
#
# See "Fleet configuration versioning" in page091_major_upgrade.md.

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys

from google.protobuf import descriptor_pb2

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TOOL = os.path.join(SOURCE_DIR, "src", "sh", "fleet", "jaia-fleet-config.py")

spec = importlib.util.spec_from_file_location("jaia_fleet_config", TOOL)
fc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fc)

ROOT_MESSAGE = fc.FLEET_CONFIG_TYPE
DEBCONF_PACKAGE = "jaiabot-embedded"
DEBCONF_INTERNAL_PREFIX = "debconf_state_"

PROTO_NAME = "fleet_config.proto"
TEMPLATES_NAME = "jaiabot-embedded.templates"

LABELS = {
    descriptor_pb2.FieldDescriptorProto.LABEL_OPTIONAL: "optional",
    descriptor_pb2.FieldDescriptorProto.LABEL_REQUIRED: "required",
    descriptor_pb2.FieldDescriptorProto.LABEL_REPEATED: "repeated",
}

COMPATIBLE = "compatible"
BREAKING = "breaking"
FORBIDDEN = "forbidden"


class Change:
    def __init__(self, kind, text):
        self.kind = kind
        self.text = text

    def __repr__(self):
        return "{}: {}".format(self.kind, self.text)


###############################################################################
# Contract model: a plain dict built from a descriptor set (+ templates for v1)
###############################################################################


def type_name(field):
    return descriptor_pb2.FieldDescriptorProto.Type.Name(field.type)[len("TYPE_"):].lower()


def proto_contract(descriptor_set):
    messages = {}
    enums = {}

    def collect(prefix, message):
        full = prefix + message.name
        messages[full] = message
        for nested in message.nested_type:
            collect(full + ".", nested)
        for enum in message.enum_type:
            enums[full + "." + enum.name] = enum

    for file in descriptor_set.file:
        prefix = file.package + "." if file.package else ""
        for message in file.message_type:
            collect(prefix, message)
        for enum in file.enum_type:
            enums[prefix + enum.name] = enum

    if ROOT_MESSAGE not in messages:
        raise ValueError("{} not found in descriptor set".format(ROOT_MESSAGE))

    reachable_messages = {}
    reachable_enums = {}

    def visit(name):
        if name in reachable_messages:
            return
        message = messages[name]
        reachable_messages[name] = message
        for field in message.field:
            if field.type == descriptor_pb2.FieldDescriptorProto.TYPE_MESSAGE:
                visit(field.type_name.lstrip("."))
            elif field.type == descriptor_pb2.FieldDescriptorProto.TYPE_ENUM:
                enum_name = field.type_name.lstrip(".")
                reachable_enums[enum_name] = enums[enum_name]

    visit(ROOT_MESSAGE)

    def field_entry(field):
        entry = {"number": field.number, "label": LABELS[field.label], "type": type_name(field)}
        if field.type_name:
            entry["type_name"] = field.type_name.lstrip(".")
        if field.HasField("default_value"):
            entry["default"] = field.default_value
        if field.options.deprecated:
            entry["deprecated"] = True
        return entry

    def enum_entry(enum):
        return {
            value.name: ({"number": value.number, "deprecated": True} if value.options.deprecated
                         else {"number": value.number})
            for value in enum.value
        }

    return {
        "root": ROOT_MESSAGE,
        "messages": {name: {"fields": {f.name: field_entry(f) for f in message.field}}
                     for name, message in sorted(reachable_messages.items())},
        "enums": {name: enum_entry(enum) for name, enum in sorted(reachable_enums.items())},
    }


def parse_debconf_templates(text):
    """Stanzas of 'Field: value' lines, continuation lines start with a space."""
    stanzas = []
    current = None
    for line in text.splitlines():
        if not line.strip():
            current = None
            continue
        if line[0] in " \t":
            continue
        field, _, value = line.partition(":")
        if current is None:
            current = {}
            stanzas.append(current)
        current[field.strip()] = value.strip()
    return stanzas


def debconf_contract_from_templates(templates_text):
    contract = {}
    for stanza in parse_debconf_templates(templates_text):
        key = stanza.get("Template", "")
        if not key.startswith(DEBCONF_PACKAGE + "/"):
            continue
        if key[len(DEBCONF_PACKAGE) + 1:].startswith(DEBCONF_INTERNAL_PREFIX):
            continue
        if stanza.get("Type") == "error":
            continue
        entry = {"type": stanza.get("Type", "")}
        if "Choices" in stanza:
            entry["choices"] = [c.strip() for c in stanza["Choices"].split(",")]
        if "Default" in stanza:
            entry["default"] = stanza["Default"]
        contract[key] = entry
    return dict(sorted(contract.items()))


def debconf_contract_from_schema(schema):
    contract = {}
    for q in schema.questions:
        entry = {"type": q.type, "field": q.name, "group": q.group}
        if q.choices is not None:
            entry["choices"] = list(q.choices)
        if q.default is not None:
            entry["default"] = q.default
        if q.identity:
            entry["identity"] = True
        replaced = {v.value: v.replaced_by for v in q.enum_values if v.deprecated and v.replaced_by}
        if replaced:
            entry["replaced"] = replaced
        contract[q.key] = entry
    return dict(sorted(contract.items()))


def build_model(descriptor_set_bytes, templates_text=None, where="fleet_config.proto"):
    schema = fc.Schema(descriptor_set_bytes)
    fds = descriptor_pb2.FileDescriptorSet.FromString(descriptor_set_bytes)
    model = {"version": schema.version, "proto": proto_contract(fds)}
    if schema.questions:
        model["proto"]["settings_message"] = fc.NODE_SETTINGS_TYPE
        model["debconf"] = debconf_contract_from_schema(schema)
    elif templates_text is not None:
        model["debconf"] = debconf_contract_from_templates(templates_text)
    else:
        raise ValueError("{} has no NodeSettings questions and no {} was given".format(where, TEMPLATES_NAME))
    return model


###############################################################################
# Classification
###############################################################################


def diff_proto(old, new, changes):
    if old["root"] != new["root"]:
        changes.append(Change(FORBIDDEN, "root message changed from {} to {}".format(old["root"], new["root"])))

    settings_message = new.get("settings_message")
    for name, old_msg in old["messages"].items():
        new_msg = new["messages"].get(name)
        if new_msg is None:
            changes.append(Change(FORBIDDEN, "message {} was removed".format(name)))
            continue
        diff_fields(name, old_msg["fields"], new_msg["fields"], changes, name == settings_message)

    for name in new["messages"]:
        if name not in old["messages"]:
            changes.append(Change(COMPATIBLE, "message {} added".format(name)))

    for name, old_enum in old["enums"].items():
        new_enum = new["enums"].get(name)
        if new_enum is None:
            changes.append(Change(FORBIDDEN, "enum {} was removed".format(name)))
            continue
        for value, old_entry in old_enum.items():
            new_entry = new_enum.get(value)
            if new_entry is None:
                changes.append(Change(FORBIDDEN, "enum value {}.{} was removed; mark it [deprecated = true] instead".format(name, value)))
            elif new_entry["number"] != old_entry["number"]:
                changes.append(Change(FORBIDDEN, "enum value {}.{} changed number".format(name, value)))
            elif new_entry.get("deprecated") and not old_entry.get("deprecated"):
                changes.append(Change(BREAKING, "enum value {}.{} deprecated: configs using it need a migration".format(name, value)))
        for value in new_enum:
            if value not in old_enum:
                changes.append(Change(COMPATIBLE, "enum value {}.{} added".format(name, value)))

    for name in new["enums"]:
        if name not in old["enums"]:
            changes.append(Change(COMPATIBLE, "enum {} added".format(name)))


def diff_fields(message, old_fields, new_fields, changes, is_settings):
    for name, old_field in old_fields.items():
        path = "{}.{}".format(message, name)
        new_field = new_fields.get(name)
        if new_field is None:
            changes.append(Change(FORBIDDEN, "field {} ({}) was removed; mark it [deprecated = true] instead so older files still parse".format(
                path, old_field["number"])))
            continue
        for attr in ("number", "label", "type", "type_name"):
            if old_field.get(attr) != new_field.get(attr):
                changes.append(Change(FORBIDDEN, "field {} changed {} from {} to {}".format(
                    path, attr, old_field.get(attr), new_field.get(attr))))
        if old_field.get("default") != new_field.get("default"):
            # a settings default only seeds unanswered questions; fleet configs carry explicit values
            kind = COMPATIBLE if is_settings else BREAKING
            changes.append(Change(kind, "field {} changed default from {!r} to {!r}".format(
                path, old_field.get("default"), new_field.get("default"))))
        if new_field.get("deprecated") and not old_field.get("deprecated"):
            changes.append(Change(BREAKING, "field {} deprecated: migration must clear it".format(path)))

    for name, new_field in new_fields.items():
        if name in old_fields:
            continue
        path = "{}.{}".format(message, name)
        if new_field["label"] == "required":
            changes.append(Change(BREAKING, "required field {} added: older files cannot satisfy it (prefer optional plus a validation rule)".format(path)))
        else:
            changes.append(Change(COMPATIBLE, "{} field {} added".format(new_field["label"], path)))


def diff_debconf(old, new, changes):
    for key, old_entry in old.items():
        new_entry = new.get(key)
        if new_entry is None:
            changes.append(Change(BREAKING, "debconf {} removed: migration must drop it".format(key)))
            continue
        if old_entry["type"] != new_entry["type"]:
            changes.append(Change(BREAKING, "debconf {} changed type from {} to {}".format(key, old_entry["type"], new_entry["type"])))
        if bool(old_entry.get("identity")) != bool(new_entry.get("identity")):
            changes.append(Change(BREAKING, "debconf {} changed whether it is set per node".format(key)))
        old_choices = set(old_entry.get("choices", []))
        new_choices = set(new_entry.get("choices", []))
        replaced = new_entry.get("replaced", {})
        for choice in sorted(old_choices - new_choices):
            if choice in replaced:
                changes.append(Change(BREAKING, "debconf {} choice {!r} now maps to {!r}: migration".format(key, choice, replaced[choice])))
            else:
                changes.append(Change(BREAKING, "debconf {} choice {!r} removed: migration must map it".format(key, choice)))
        for choice in sorted(new_choices - old_choices):
            changes.append(Change(COMPATIBLE, "debconf {} choice {!r} added".format(key, choice)))
        if old_entry.get("default") != new_entry.get("default"):
            changes.append(Change(COMPATIBLE, "debconf {} default changed from {!r} to {!r}".format(
                key, old_entry.get("default"), new_entry.get("default"))))

    for key, new_entry in new.items():
        if key in old:
            continue
        if "default" in new_entry:
            changes.append(Change(COMPATIBLE, "debconf {} added with default {!r}".format(key, new_entry["default"])))
        else:
            changes.append(Change(BREAKING, "debconf {} added without a default: migration must supply a value".format(key)))


def diff(old, new):
    changes = []
    diff_proto(old["proto"], new["proto"], changes)
    diff_debconf(old["debconf"], new["debconf"], changes)
    return changes


def worst(changes):
    for kind in (FORBIDDEN, BREAKING, COMPATIBLE):
        if any(c.kind == kind for c in changes):
            return kind
    return None


###############################################################################
# Sources and snapshots
###############################################################################

VERSION_RE = re.compile(r"^option \(jaia\.file\)\.fleet_config_version = (\d+);", re.M)


def declared_version(proto_path):
    with open(proto_path) as f:
        match = VERSION_RE.search(f.read())
    if not match:
        raise ValueError("{} does not declare 'option (jaia.file).fleet_config_version = N;'".format(proto_path))
    return int(match.group(1))


def model_from_sources(proto_path, includes, protoc, templates_path=None):
    """Compile proto_path (searched first in its own directory) and build the model."""
    data = fc.compile_descriptor_set(proto_path, [os.path.dirname(os.path.abspath(proto_path))] + list(includes), protoc)
    templates_text = None
    if templates_path and os.path.exists(templates_path):
        with open(templates_path) as f:
            templates_text = f.read()
    model = build_model(data, templates_text, proto_path)
    declared = declared_version(proto_path)
    if model["version"] != declared:
        raise ValueError("{}: descriptor version {} != declared {}".format(proto_path, model["version"], declared))
    return model


def snapshot_dir(root, version):
    return os.path.join(root, "v{}".format(version))


def load_snapshot(root, version, includes, protoc):
    directory = snapshot_dir(root, version)
    proto = os.path.join(directory, PROTO_NAME)
    if not os.path.exists(proto):
        raise FileNotFoundError(proto)
    model = model_from_sources(proto, includes, protoc, os.path.join(directory, TEMPLATES_NAME))
    if model["version"] != version:
        raise ValueError("{} declares version {}, expected {}".format(proto, model["version"], version))
    return model


def dump(model):
    return json.dumps(model, indent=2, sort_keys=True) + "\n"


###############################################################################
# Commands
###############################################################################


def print_changes(changes, file=sys.stderr):
    for kind in (FORBIDDEN, BREAKING, COMPATIBLE):
        for change in changes:
            if change.kind == kind:
                print("  [{}] {}".format(kind, change.text), file=file)


def fail(*lines):
    print("fleet config contract check FAILED", file=sys.stderr)
    for line in lines:
        print(line, file=sys.stderr)
    return 1


def current_model(args):
    return model_from_sources(args.proto, args.include or [], args.protoc, args.templates)


def cmd_show(args):
    sys.stdout.write(dump(current_model(args)))
    return 0


def cmd_write(args):
    model = current_model(args)
    directory = snapshot_dir(args.snapshot_dir, model["version"])
    os.makedirs(directory, exist_ok=True)
    shutil.copyfile(args.proto, os.path.join(directory, PROTO_NAME))
    written = [os.path.join(directory, PROTO_NAME)]
    if "settings_message" not in model["proto"]:
        shutil.copyfile(args.templates, os.path.join(directory, TEMPLATES_NAME))
        written.append(os.path.join(directory, TEMPLATES_NAME))
    for path in written:
        print("wrote " + path)
    return 0


def cmd_diff(args):
    old = load_snapshot(args.snapshot_dir, args.old, args.include or [], args.protoc)
    new = load_snapshot(args.snapshot_dir, args.new, args.include or [], args.protoc)
    changes = diff(old, new)
    print_changes(changes, file=sys.stdout)
    print("result: {}".format(worst(changes) or "identical"))
    return 0


def cmd_check(args):
    version = declared_version(args.proto)
    root = args.snapshot_dir
    how_to_write = "  {} write ...".format(os.path.relpath(__file__, SOURCE_DIR))

    if not os.path.exists(os.path.join(snapshot_dir(root, version), PROTO_NAME)):
        return fail("No contract snapshot for fleet config version {} at {}/.".format(version, snapshot_dir(root, version)),
                    "If you just bumped (jaia.file).fleet_config_version, write the new snapshot with:", how_to_write)

    # History must be contiguous (migrations go one version at a time) and must
    # never contain an edit that stops older files from parsing
    previous = None
    for v in range(1, version + 1):
        try:
            snapshot = load_snapshot(root, v, args.include or [], args.protoc)
        except FileNotFoundError:
            return fail("Contract snapshot v{}/ is missing but v{}/ exists: versions must be contiguous.".format(v, version))
        except (ValueError, subprocess.CalledProcessError) as e:
            return fail(str(e))
        if previous is not None:
            forbidden = [c for c in diff(previous, snapshot) if c.kind == FORBIDDEN]
            if forbidden:
                print_changes(forbidden)
                return fail("Contract snapshot v{}/ is not a valid successor of v{}/ (see above).".format(v, v - 1),
                            "Fields and enum values are never removed from fleet_config.proto: mark them [deprecated = true].")
        previous = snapshot

    model = current_model(args)
    changes = diff(previous, model)
    result = worst(changes)
    if result is None:
        return 0

    print_changes(changes)
    if result == FORBIDDEN:
        return fail("fleet_config.proto has changes that would stop existing fleet configs from parsing (see [forbidden] above).",
                    "Fields and enum values are never removed or renamed: mark them [deprecated = true] and add a migration.")
    if result == BREAKING:
        return fail("The fleet config contract has breaking changes relative to version {} (see [breaking] above).".format(version),
                    "To proceed:",
                    "  1. increment (jaia.file).fleet_config_version in src/lib/messages/fleet_config.proto",
                    "  2. add the matching migration step to src/sh/fleet/jaia-fleet-config.py (see page091_major_upgrade.md)",
                    "  3. write the new snapshot:", how_to_write)
    return fail("The fleet config contract changed compatibly relative to version {} (see [compatible] above).".format(version),
                "No version bump is needed; refresh the snapshot with:", how_to_write)


def main():
    parser = argparse.ArgumentParser(description="Snapshot and check the fleet config contract.")
    parser.add_argument("--proto", default=os.path.join(SOURCE_DIR, "src", "lib", "messages", PROTO_NAME))
    parser.add_argument("--templates", default=os.path.join(SOURCE_DIR, "debian", TEMPLATES_NAME),
                        help="only used for versions without NodeSettings questions")
    parser.add_argument("-I", "--include", action="append", help="protoc include directory (for jaiabot/messages/option_extensions.proto)")
    parser.add_argument("--protoc", default="protoc")
    parser.add_argument("--snapshot-dir", default=os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config", "contract"))
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("show", help="print the current contract model as JSON").set_defaults(func=cmd_show)
    sub.add_parser("check", help="compare the current contract with the snapshot for the declared version").set_defaults(func=cmd_check)
    sub.add_parser("write", help="freeze the current sources as the snapshot for the declared version").set_defaults(func=cmd_write)
    p = sub.add_parser("diff", help="classify the differences between two snapshot versions")
    p.add_argument("old", type=int)
    p.add_argument("new", type=int)
    p.set_defaults(func=cmd_diff)

    args = parser.parse_args()
    if not args.include:
        args.include = [os.path.join(SOURCE_DIR, "src", "lib", "messages")]
    try:
        return args.func(args)
    except (OSError, ValueError, subprocess.CalledProcessError, fc.FleetConfigError) as e:
        return fail(str(e))


if __name__ == "__main__":
    sys.exit(main())
