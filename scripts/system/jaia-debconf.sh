#!/bin/bash

# Shared reader for the jaiabot-embedded debconf database, the single source of
# truth for bot/hub configuration.
#
#     jaia-debconf.sh type
#     source /usr/bin/jaia-debconf.sh && jaia_debconf_get fleet_id
#
# Requires root, and that no maintainer script is holding an open debconf
# conversation: db_set writes live in the frontend's memory until it shuts down,
# so call db_stop first or read pre-maintainer-script values.

JAIA_DEBCONF_PACKAGE=jaiabot-embedded

# jaia_debconf_get <question> [default]
# Fails if the question is unanswered and no default was supplied.
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
# bot_id or hub_id, whichever matches jaiabot-embedded/type.
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
# Dumps this node's answers in debconf-set-selections format - the same format
# 'systemd.py --debconf_selections' takes, so both paths parse identical input.
jaia_debconf_selections() {
    local out

    if ! command -v debconf-get-selections > /dev/null 2>&1; then
        echo "ERROR: debconf-get-selections not found (install the 'debconf-utils' package)." >&2
        return 1
    fi

    # the pipeline swallows debconf-get-selections' exit status, so an empty
    # result is the only reliable failure signal
    out=$(debconf-get-selections 2>/dev/null \
              | grep "[[:space:]]${JAIA_DEBCONF_PACKAGE}/" \
              | sed "s/^unknown/${JAIA_DEBCONF_PACKAGE}/")

    if [ -z "${out}" ]; then
        echo "ERROR: no ${JAIA_DEBCONF_PACKAGE} answers found in the debconf database." >&2
        echo "       Reading debconf requires root; if you are root, run" >&2
        echo "       'sudo dpkg-reconfigure ${JAIA_DEBCONF_PACKAGE}' to populate it." >&2
        return 1
    fi

    echo "${out}"
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
