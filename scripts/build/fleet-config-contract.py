#!/usr/bin/env python3
#
# The fleet config "contract": everything a fleet configuration file (a
# jaiabot.protobuf.FleetConfig in text format) must conform to. That is more
# than the .proto - the debconf answers it carries are opaque strings to
# protobuf, so jaiabot-embedded.templates is part of the contract too.
#
# One snapshot per PROJECT_FLEET_CONFIG_VERSION is committed under
# src/lib/messages/fleet_config/contract/vN.json. At build time 'check'
# regenerates the contract and diffs it against the snapshot for the current
# version: compatible changes need the snapshot refreshed ('write'), breaking
# ones need a version bump and a migration, and a few edits (deleting a field)
# are refused outright because older files would stop parsing.
#
# See src/doc/markdown/page091_major_upgrade.md.

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

from google.protobuf import descriptor_pb2

ROOT_MESSAGE = "jaiabot.protobuf.FleetConfig"
DEBCONF_PACKAGE = "jaiabot-embedded"

# Where the interactive dpkg-reconfigure menu is, not configuration
DEBCONF_INTERNAL_PREFIX = "debconf_state_"

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
# Contract generation
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

    # Only what is reachable from the root belongs to the contract
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
        entry = {
            "number": field.number,
            "label": LABELS[field.label],
            "type": type_name(field),
        }
        if field.type_name:
            entry["type_name"] = field.type_name.lstrip(".")
        if field.HasField("default_value"):
            entry["default"] = field.default_value
        if field.options.deprecated:
            entry["deprecated"] = True
        return entry

    def enum_entry(enum):
        return {
            value.name: (
                {"number": value.number, "deprecated": True}
                if value.options.deprecated
                else {"number": value.number}
            )
            for value in enum.value
        }

    return {
        "root": ROOT_MESSAGE,
        "messages": {
            name: {"fields": {field.name: field_entry(field) for field in message.field}}
            for name, message in sorted(reachable_messages.items())
        },
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


def debconf_contract(templates_text):
    contract = {}
    for stanza in parse_debconf_templates(templates_text):
        key = stanza.get("Template", "")
        if not key.startswith(DEBCONF_PACKAGE + "/"):
            continue
        question = key[len(DEBCONF_PACKAGE) + 1:]
        if question.startswith(DEBCONF_INTERNAL_PREFIX):
            continue
        entry = {"type": stanza.get("Type", "")}
        if "Choices" in stanza:
            entry["choices"] = [c.strip() for c in stanza["Choices"].split(",")]
        if "Default" in stanza:
            entry["default"] = stanza["Default"]
        contract[key] = entry
    return dict(sorted(contract.items()))


def generate(descriptor_set, templates_text, version):
    return {
        "version": version,
        "proto": proto_contract(descriptor_set),
        "debconf": debconf_contract(templates_text),
    }


###############################################################################
# Classification
###############################################################################


def diff_proto(old, new, changes):
    if old["root"] != new["root"]:
        changes.append(Change(FORBIDDEN, "root message changed from {} to {}".format(old["root"], new["root"])))

    for name, old_msg in old["messages"].items():
        new_msg = new["messages"].get(name)
        if new_msg is None:
            changes.append(Change(FORBIDDEN, "message {} was removed".format(name)))
            continue
        diff_fields(name, old_msg["fields"], new_msg["fields"], changes)

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
                changes.append(Change(FORBIDDEN,
                                      "enum value {}.{} was removed; mark it [deprecated = true] instead".format(name, value)))
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


def diff_fields(message, old_fields, new_fields, changes):
    for name, old_field in old_fields.items():
        path = "{}.{}".format(message, name)
        new_field = new_fields.get(name)
        if new_field is None:
            changes.append(Change(FORBIDDEN,
                                  "field {} ({}) was removed; mark it [deprecated = true] instead so older files still parse".format(
                                      path, old_field["number"])))
            continue
        for attr in ("number", "label", "type", "type_name"):
            if old_field.get(attr) != new_field.get(attr):
                changes.append(Change(FORBIDDEN, "field {} changed {} from {} to {}".format(
                    path, attr, old_field.get(attr), new_field.get(attr))))
        if old_field.get("default") != new_field.get("default"):
            changes.append(Change(BREAKING, "field {} changed default from {!r} to {!r}".format(
                path, old_field.get("default"), new_field.get("default"))))
        if new_field.get("deprecated") and not old_field.get("deprecated"):
            changes.append(Change(BREAKING, "field {} deprecated: migration must clear it".format(path)))

    for name, new_field in new_fields.items():
        if name in old_fields:
            continue
        path = "{}.{}".format(message, name)
        if new_field["label"] == "required":
            changes.append(Change(BREAKING,
                                  "required field {} added: older files cannot satisfy it (prefer optional plus a validation rule)".format(path)))
        else:
            changes.append(Change(COMPATIBLE, "{} field {} added".format(new_field["label"], path)))


def diff_debconf(old, new, changes):
    for key, old_entry in old.items():
        new_entry = new.get(key)
        if new_entry is None:
            changes.append(Change(BREAKING, "debconf {} removed: migration must drop it".format(key)))
            continue
        if old_entry["type"] != new_entry["type"]:
            changes.append(Change(BREAKING, "debconf {} changed type from {} to {}".format(
                key, old_entry["type"], new_entry["type"])))
        old_choices = set(old_entry.get("choices", []))
        new_choices = set(new_entry.get("choices", []))
        for choice in sorted(old_choices - new_choices):
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
            changes.append(Change(BREAKING, "debconf {} added without a Default: migration must supply a value".format(key)))


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
# Snapshots
###############################################################################


def snapshot_path(snapshot_dir, version):
    return os.path.join(snapshot_dir, "v{}.json".format(version))


def load_snapshot(snapshot_dir, version):
    path = snapshot_path(snapshot_dir, version)
    with open(path) as f:
        snapshot = json.load(f)
    if snapshot.get("version") != version:
        raise ValueError("{} declares version {}, expected {}".format(path, snapshot.get("version"), version))
    return snapshot


def dump(contract):
    return json.dumps(contract, indent=2, sort_keys=True) + "\n"


def write_output(path, contract):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        f.write(dump(contract))


###############################################################################
# Commands
###############################################################################


def load_descriptor_set(args):
    if args.descriptor_set:
        with open(args.descriptor_set, "rb") as f:
            data = f.read()
    else:
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "fleet_config.desc")
            proto = os.path.abspath(args.proto)
            cmd = [args.protoc, "--descriptor_set_out=" + out, "--include_imports"]
            for include in args.include or [os.path.dirname(proto)]:
                cmd.append("-I" + os.path.abspath(include))
            cmd.append(proto)
            subprocess.run(cmd, check=True)
            with open(out, "rb") as f:
                data = f.read()
    return descriptor_pb2.FileDescriptorSet.FromString(data)


def current_contract(args):
    with open(args.templates) as f:
        templates_text = f.read()
    return generate(load_descriptor_set(args), templates_text, args.version)


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


def cmd_generate(args):
    contract = current_contract(args)
    if args.output:
        write_output(args.output, contract)
    else:
        sys.stdout.write(dump(contract))
    return 0


def cmd_write(args):
    contract = current_contract(args)
    path = snapshot_path(args.snapshot_dir, args.version)
    write_output(path, contract)
    print("wrote {}".format(path))
    return 0


def cmd_diff(args):
    with open(args.old) as f:
        old = json.load(f)
    with open(args.new) as f:
        new = json.load(f)
    changes = diff(old, new)
    print_changes(changes, file=sys.stdout)
    print("result: {}".format(worst(changes) or "identical"))
    return 0


def cmd_check(args):
    version = args.version
    snapshot_dir = args.snapshot_dir
    how_to_write = "  {} write --version {} ...".format(os.path.basename(sys.argv[0]), version)

    if not os.path.exists(snapshot_path(snapshot_dir, version)):
        return fail("No contract snapshot for fleet config version {} at {}.".format(version, snapshot_path(snapshot_dir, version)),
                    "If you just bumped PROJECT_FLEET_CONFIG_VERSION, write the new snapshot with:",
                    how_to_write)

    # History must be contiguous (migrations diff consecutive snapshots) and
    # must never contain an edit that stops older files from parsing.
    previous = None
    for v in range(1, version + 1):
        try:
            snapshot = load_snapshot(snapshot_dir, v)
        except FileNotFoundError:
            return fail("Contract snapshot v{}.json is missing but v{}.json exists: versions must be contiguous.".format(v, version))
        except ValueError as e:
            return fail(str(e))
        if previous is not None:
            forbidden = [c for c in diff(previous, snapshot) if c.kind == FORBIDDEN]
            if forbidden:
                print_changes(forbidden)
                return fail("Contract snapshot v{}.json is not a valid successor of v{}.json (see above).".format(v, v - 1),
                            "Fields and enum values are never removed from fleet_config.proto: mark them [deprecated = true].")
        previous = snapshot

    contract = current_contract(args)
    changes = diff(previous, contract)
    result = worst(changes)

    if result is None:
        if args.output:
            write_output(args.output, contract)
        return 0

    print_changes(changes)
    if result == FORBIDDEN:
        return fail("fleet_config.proto has changes that would stop existing fleet configs from parsing (see [forbidden] above).",
                    "Fields and enum values are never removed or renamed: mark them [deprecated = true] and add a migration.")
    if result == BREAKING:
        return fail("The fleet config contract has breaking changes relative to version {} (see [breaking] above).".format(version),
                    "To proceed:",
                    "  1. increment PROJECT_FLEET_CONFIG_VERSION in cmake/JaiaVersions.cmake",
                    "  2. add the matching migration step (see page091_major_upgrade.md)",
                    "  3. write the new snapshot:",
                    how_to_write.replace("--version {}".format(version), "--version {}".format(version + 1)))
    return fail("The fleet config contract changed compatibly relative to version {} (see [compatible] above).".format(version),
                "No version bump is needed; refresh the snapshot with:",
                how_to_write)


def main():
    parser = argparse.ArgumentParser(description="Generate, snapshot and check the fleet config contract.")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_source_args(p):
        source = p.add_mutually_exclusive_group(required=True)
        source.add_argument("--proto", help="fleet_config.proto (compiled with protoc)")
        source.add_argument("--descriptor-set", help="FileDescriptorSet already produced by protoc")
        p.add_argument("-I", "--include", action="append", help="protoc include directory (with --proto)")
        p.add_argument("--protoc", default="protoc", help="protoc executable (with --proto)")
        p.add_argument("--templates", required=True, help="debian/jaiabot-embedded.templates")
        p.add_argument("--version", type=int, required=True, help="PROJECT_FLEET_CONFIG_VERSION")

    p = sub.add_parser("generate", help="write the current contract as JSON")
    add_source_args(p)
    p.add_argument("-o", "--output", help="output file (default: stdout)")
    p.set_defaults(func=cmd_generate)

    p = sub.add_parser("check", help="compare the current contract with the snapshot for --version")
    add_source_args(p)
    p.add_argument("--snapshot-dir", required=True)
    p.add_argument("-o", "--output", help="on success, also write the contract here")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("write", help="write the snapshot for --version")
    add_source_args(p)
    p.add_argument("--snapshot-dir", required=True)
    p.set_defaults(func=cmd_write)

    p = sub.add_parser("diff", help="classify the differences between two contract files")
    p.add_argument("old")
    p.add_argument("new")
    p.set_defaults(func=cmd_diff)

    args = parser.parse_args()
    try:
        return args.func(args)
    except (OSError, ValueError, subprocess.CalledProcessError) as e:
        return fail(str(e))


if __name__ == "__main__":
    sys.exit(main())
