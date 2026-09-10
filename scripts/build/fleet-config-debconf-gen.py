#!/usr/bin/env python3
#
# Generates debian/jaiabot-embedded.templates and debian/jaiabot-embedded.config
# from the NodeSettings message in fleet_config.proto (see "Fleet configuration
# versioning" in page091_major_upgrade.md). Both generated files are committed;
# the build runs --check to make sure they are current.

import argparse
import importlib.util
import os
import sys

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TOOL = os.path.join(SOURCE_DIR, "src", "sh", "fleet", "jaia-fleet-config.py")

spec = importlib.util.spec_from_file_location("jaia_fleet_config", TOOL)
fc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fc)

GROUP_NAMES = {"ALL": "common", "BOT": "bot", "HUB": "hub"}
GENERATED_NOTICE = "Generated from src/lib/messages/fleet_config.proto by scripts/build/fleet-config-debconf-gen.py - do not edit"


def state_key(schema, group):
    return "{}/debconf_state_{}".format(schema.package, GROUP_NAMES[group])


def menu_choices(schema, group):
    names = [q.name for q in schema.group_questions(group)]
    if group == "ALL":
        return names + ["NEXT"]
    return ["BACK"] + names + ["EXIT"]


def templates_text(schema):
    # no notice: the templates format has no comment syntax
    out = []
    for group in ("ALL", "BOT", "HUB"):
        out += [
            "Template: " + state_key(schema, group),
            "Type: select",
            "Choices: " + ", ".join(menu_choices(schema, group)),
            "Description: Choose a {} option to edit".format(GROUP_NAMES[group]),
            "",
        ]
    for q in schema.questions:
        out.append("Template: " + q.key)
        out.append("Type: " + q.type)
        if q.choices is not None:
            out.append("Choices: " + ", ".join(q.choices))
        if q.default is not None:
            out.append("Default:" + (" " + q.default if q.default else ""))
        out.append("Description: " + q.description)
        for line in q.extended_description.splitlines():
            out.append("  " + line)
        out.append("")
    return "\n".join(out)


CONFIG_PROLOGUE = r'''#!/bin/sh -e

# {notice}

# Source debconf library.
. /usr/share/debconf/confmodule

# Enable backup capability
db_capb backup

# General function for handling debconf input and go
# Returns 0 if the user moves forward, 1 if the user chooses to back up
debconf_input_and_go() {{
    db_input "$1" "$2" || true
    if db_go; then
        return 0
    else
        return 1
    fi
}}

go_menu() {{
    db_fset $1 seen false
    db_input high $1 || true
    db_go
    db_get $1
    state=$RET
}}
'''

CONFIG_EPILOGUE = r'''
# State machine for overall configuration
configure() {{
    local state="CONFIGURE_COMMON"
    while true; do
        case $state in
            "CONFIGURE_COMMON")
                if configure_common; then
                    db_get {node_type_key}
                    JAIA_TYPE=$RET
{type_dispatch}                fi
                ;;
{group_arms}            *)
                echo "Invalid state encountered in configure: $state"
                return 1
                ;;
        esac
    done
}}

configure
'''


def normalisation_arms(q):
    """(value -> replacement) pairs applied after a question is answered."""
    arms = []
    for ev in q.enum_values:
        if ev.deprecated and ev.replaced_by:
            arms.append((ev.value, ev.replaced_by))
    if q.unasked_value is not None and q.default not in (None, q.unasked_value):
        arms.append((q.unasked_value, q.default))
    return arms


def question_arm(schema, q, next_state, menu):
    ind = "            "
    lines = ['{}"{}")'.format(ind, q.name)]
    body = []
    body.append("if debconf_input_and_go {} {}; then".format(q.priority.lower(), q.key))
    arms = normalisation_arms(q)
    if arms:
        body.append("    db_get {}".format(q.key))
        body.append('    case "$RET" in')
        for old, new in arms:
            body.append("        {}) db_set {} {} ;;".format(old, q.key, new))
        body.append("    esac")
    body.append("    " + next_state)
    body.append("else")
    body.append("    go_menu {}".format(menu))
    body.append("fi")
    if q.ask_if:
        field, equals = q.ask_if
        condition = schema.questions_by_name[field]
        wrapped = ["db_get {}".format(condition.key), 'if [ "$RET" = "{}" ]; then'.format(equals)]
        wrapped += ["    " + line for line in body]
        wrapped.append("else")
        if q.unasked_value is not None:
            wrapped.append("    db_set {} {}".format(q.key, q.unasked_value))
        wrapped.append("    " + next_state)
        wrapped.append("fi")
        body = wrapped
    lines += [ind + "    " + line for line in body]
    lines.append(ind + "    ;;")
    return "\n".join(lines)


def group_function(schema, group):
    name = GROUP_NAMES[group]
    questions = schema.group_questions(group)
    menu = state_key(schema, group)
    ind = "            "
    out = ["", "# State machine for \"{}\" configuration".format(name), "configure_{}() {{".format(name)]
    out.append('    local state="{}"'.format(questions[0].name))
    # Questions of the other groups are never asked on this node: set the
    # values they hold when unasked
    for other in ("BOT", "HUB"):
        if other == group or group == "ALL":
            continue
        for q in schema.group_questions(other):
            if q.unasked_value is not None:
                out.append("    db_set {} {}".format(q.key, q.unasked_value))
    out.append("    while true; do")
    out.append("        db_set {} $state".format(menu))
    out.append("        case $state in")
    if group != "ALL":
        out += [ind + '"BACK")', ind + "    return 1", ind + "    ;;"]
    for i, q in enumerate(questions):
        if i + 1 < len(questions):
            next_state = 'state="{}"'.format(questions[i + 1].name)
        else:
            next_state = "return 0  # end of {} questions".format(name)
        out.append(question_arm(schema, q, next_state, menu))
    done = "NEXT" if group == "ALL" else "EXIT"
    out += [ind + '"{}")'.format(done), ind + "    return 0", ind + "    ;;"]
    out += [ind + "*)", ind + '    echo "Invalid state encountered in configure_{}: $state"'.format(name),
            ind + "    return 1", ind + "    ;;"]
    out += ["        esac", "    done", "}"]
    return "\n".join(out)


def config_text(schema):
    node_type = schema.questions_by_name[schema.node_type_field]
    dispatch = []
    for i, ev in enumerate(node_type.enum_values):
        if ev.deprecated:
            continue
        group = ev.value.upper()
        if group not in GROUP_NAMES:
            raise fc.FleetConfigError("{} value {} has no question group".format(node_type.key, ev.value))
        dispatch.append('                    {} [ "$JAIA_TYPE" = "{}" ]; then'.format("if" if i == 0 else "elif", ev.value))
        dispatch.append('                        state="CONFIGURE_{}"'.format(group))
    dispatch.append("                    fi")
    group_arms = []
    for group in ("BOT", "HUB"):
        group_arms += [
            '            "CONFIGURE_{}")'.format(group),
            "                if configure_{}; then".format(GROUP_NAMES[group]),
            "                    return 0  # Success, end configuration",
            "                else",
            '                    state="CONFIGURE_COMMON"',
            "                fi",
            "                ;;",
        ]
    text = CONFIG_PROLOGUE.format(notice=GENERATED_NOTICE)
    for group in ("ALL", "BOT", "HUB"):
        text += group_function(schema, group) + "\n"
    text += CONFIG_EPILOGUE.format(node_type_key=node_type.key,
                                   type_dispatch="\n".join(dispatch) + "\n",
                                   group_arms="\n".join(group_arms) + "\n")
    return text


def main():
    parser = argparse.ArgumentParser(description="Generate the jaiabot-embedded debconf templates and config script from fleet_config.proto")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--proto", help="fleet_config.proto (compiled with protoc)")
    source.add_argument("--descriptor-set", help="FileDescriptorSet already produced by protoc")
    parser.add_argument("-I", "--include", action="append", help="protoc include directory (with --proto)")
    parser.add_argument("--protoc", default="protoc")
    parser.add_argument("--templates", default=os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.templates"))
    parser.add_argument("--config", default=os.path.join(SOURCE_DIR, "debian", "jaiabot-embedded.config"))
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="write both files")
    mode.add_argument("--check", action="store_true", help="fail if either committed file differs from what would be generated")
    mode.add_argument("--print", choices=["templates", "config"], help="print one file to stdout")
    args = parser.parse_args()

    if args.descriptor_set:
        with open(args.descriptor_set, "rb") as f:
            data = f.read()
    else:
        proto = args.proto or os.path.join(SOURCE_DIR, "src", "lib", "messages", "fleet_config.proto")
        data = fc.compile_descriptor_set(proto, args.include or [os.path.join(SOURCE_DIR, "src", "lib", "messages")], args.protoc)
    schema = fc.Schema(data)
    if not schema.questions:
        print("fleet_config.proto has no NodeSettings questions", file=sys.stderr)
        return 1

    generated = {args.templates: templates_text(schema), args.config: config_text(schema)}

    if args.print:
        sys.stdout.write(generated[args.templates if args.print == "templates" else args.config])
        return 0
    if args.write:
        for path, text in generated.items():
            with open(path, "w") as f:
                f.write(text)
            print("wrote " + path)
        return 0

    stale = []
    for path, text in generated.items():
        try:
            with open(path) as f:
                current = f.read()
        except FileNotFoundError:
            current = None
        if current != text:
            stale.append(path)
    if stale:
        print("debconf files are out of date with fleet_config.proto:", file=sys.stderr)
        for path in stale:
            print("  " + path, file=sys.stderr)
        print("Regenerate them with:\n  {} --write".format(os.path.relpath(__file__, SOURCE_DIR)), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
