#!/bin/bash

# Shared reader for the jaiabot-embedded debconf database, which is the single
# source of truth for bot/hub configuration.
#
# Source this file to use the functions, or call it directly to print a value:
#
#     jaia-debconf.sh type
#     source /usr/bin/jaia-debconf.sh && jaia_debconf_get fleet_id
#
# NOTE: reading debconf requires root, and requires that no maintainer script is
# holding an open debconf conversation. Inside a maintainer script, call db_stop
# first: db_set writes live in the frontend's memory and are only flushed to the
# on-disk database when the frontend shuts down, so anything reading it earlier
# sees the values from before the maintainer script ran.

JAIA_DEBCONF_PACKAGE=jaiabot-embedded

# jaia_debconf_get <question> [default]
# Prints the answer for jaiabot-embedded/<question>. Falls back to the default
# if given; fails if the question is unanswered and no default was supplied.
jaia_debconf_get() {
    local question="$1"
    local default="$2"
    local reply value

    reply=$(echo "GET ${JAIA_DEBCONF_PACKAGE}/${question}" \
                | debconf-communicate "${JAIA_DEBCONF_PACKAGE}" 2>/dev/null)

    # replies are "0 <value>" on success, or a non-zero code with a message
    case "${reply}" in
        "0 "*) value="${reply#0 }" ;;
        "0")   value="" ;;
        *)     value="" ;;
    esac

    if [ -z "${value}" ]; then
        if [ $# -ge 2 ]; then
            echo "${default}"
            return 0
        fi
        echo "ERROR: debconf question ${JAIA_DEBCONF_PACKAGE}/${question} is unanswered." >&2
        echo "       Run 'sudo dpkg-reconfigure ${JAIA_DEBCONF_PACKAGE}' to set it." >&2
        return 1
    fi

    echo "${value}"
}

# jaia_debconf_node_id
# Prints bot_id or hub_id, whichever matches jaiabot-embedded/type.
jaia_debconf_node_id() {
    local type
    type=$(jaia_debconf_get type) || return 1
    if [ "${type}" = "bot" ]; then
        jaia_debconf_get bot_id
    else
        jaia_debconf_get hub_id
    fi
}

# jaia_debconf_selections
# Dumps this node's answers in debconf-set-selections format, suitable for
# passing to 'systemd.py --debconf_selections'.
jaia_debconf_selections() {
    debconf-get-selections \
        | grep "^\(unknown\|${JAIA_DEBCONF_PACKAGE}\)[[:space:]]*${JAIA_DEBCONF_PACKAGE}/" \
        | sed "s/^unknown/${JAIA_DEBCONF_PACKAGE}/"
}

# When executed rather than sourced, print the requested question's value.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    if [ $# -lt 1 ]; then
        echo "Usage: $(basename "$0") <debconf question, e.g. fleet_id> [default]" >&2
        echo "       $(basename "$0") --selections" >&2
        exit 1
    fi
    if [ "$1" = "--selections" ]; then
        jaia_debconf_selections
    else
        jaia_debconf_get "$@"
    fi
fi
