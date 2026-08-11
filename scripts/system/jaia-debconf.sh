#!/bin/bash

# Shared reader/writer for the jaiabot-embedded debconf database, the single
# source of truth for bot/hub configuration.
#
#     jaia-debconf.sh get fleet_id
#     jaia-debconf.sh set fleet_id 3
#     jaia-debconf.sh list
#     jaia-debconf.sh selections
#     source /usr/bin/jaia-debconf.sh && jaia_debconf_get fleet_id
#
# Requires root, and that no maintainer script is holding an open debconf
# conversation: db_set writes live in the frontend's memory until it shuts down,
# so call db_stop first or read pre-maintainer-script values.

JAIA_DEBCONF_PACKAGE=jaiabot-embedded

# dpkg keeps every installed package's templates here; fall back to the source
# tree so this works from an uninstalled checkout too.
jaia_debconf_templates_file() {
    local installed="/var/lib/dpkg/info/${JAIA_DEBCONF_PACKAGE}.templates"
    local local_copy

    if [ -r "${installed}" ]; then
        echo "${installed}"
        return 0
    fi

    local_copy="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../debian/${JAIA_DEBCONF_PACKAGE}.templates"
    if [ -r "${local_copy}" ]; then
        echo "${local_copy}"
        return 0
    fi

    echo "ERROR: ${JAIA_DEBCONF_PACKAGE}.templates not found at ${installed}" >&2
    return 1
}

# jaia_debconf_template_field <question> <field, e.g. Choices or Type>
jaia_debconf_template_field() {
    local question="$1" field="$2" templates

    templates=$(jaia_debconf_templates_file) || return 1

    awk -v q="${JAIA_DEBCONF_PACKAGE}/${question}" -v f="${field}:" '
        /^Template:/ { current = $2 }
        current == q && $1 == f { sub(/^[^:]*: ?/, ""); print; exit }
    ' "${templates}"
}

# awk source, shared by the two places that show a Choices list to a human.
# bot_id and fleet_id are contiguous integer runs of 151 and 251 elements; in
# full they bury whatever else is on screen and say nothing a range does not.
JAIA_DEBCONF_AWK_COLLAPSE='
    function collapse(s,   n, a, i) {
        n = split(s, a, ",")
        if (n < 4)
            return s
        for (i = 1; i <= n; i++) {
            gsub(/^ +| +$/, "", a[i])
            if (a[i] !~ /^-?[0-9]+$/)
                return s
        }
        for (i = 2; i <= n; i++)
            if (a[i] + 0 != a[i - 1] + 1)
                return s
        return a[1] "-" a[n]
    }
'

# jaia_debconf_collapse_choices <choices>
jaia_debconf_collapse_choices() {
    echo "$1" | awk "${JAIA_DEBCONF_AWK_COLLAPSE}"' { print collapse($0) }'
}

# jaia_debconf_list [--all]
# Tabulates every question the package defines, with its type, default and
# permitted choices. This is the set of names 'get' and 'set' accept.
#
# Unlike the other subcommands this reads only the templates file, never the
# debconf database, so it does not require root and answers "what can I set?"
# rather than "what is it set to?" (that is 'selections').
jaia_debconf_list() {
    local include_internal=false templates

    if [ "${1:-}" = "--all" ]; then
        include_internal=true
        shift
    fi

    if [ $# -gt 0 ]; then
        echo "ERROR: usage: jaia_debconf_list [--all]" >&2
        return 1
    fi

    templates=$(jaia_debconf_templates_file) || return 1

    # First pass emits one tab-separated record per question, second pass pads
    # the columns to the widest entry. sort in between so the table reads as a
    # lookup rather than in templates-file order.
    awk -v pkg="${JAIA_DEBCONF_PACKAGE}" -v include_internal="${include_internal}" \
        "${JAIA_DEBCONF_AWK_COLLAPSE}"'
        # value of "Field: value", empty when the field has none
        function value(   v) {
            v = substr($0, index($0, ":") + 1)
            gsub(/^ +| +$/, "", v)
            return v
        }
        function flush() {
            if (question != "")
                printf "%s\t%s\t%s\t%s\n", question, type, dflt, collapse(choices)
            question = ""; type = ""; dflt = ""; choices = ""
        }
        /^Template:/ {
            flush()
            q = $2
            sub("^" pkg "/", "", q)
            # debconf_state_* track where the interactive menu is, they are not
            # configuration, so hide them unless asked for
            if (include_internal == "true" || q !~ /^debconf_state_/)
                question = q
            next
        }
        /^Type:/    { type = value(); next }
        /^Default:/ { dflt = value(); next }
        /^Choices:/ { choices = value(); next }
        END { flush() }
    ' "${templates}" \
        | sort \
        | awk -F'\t' '
            BEGIN { qw = length("QUESTION"); tw = length("TYPE"); dw = length("DEFAULT") }
            {
                q[NR] = $1; t[NR] = $2; d[NR] = $3; c[NR] = $4
                if (length($1) > qw) qw = length($1)
                if (length($2) > tw) tw = length($2)
                if (length($3) > dw) dw = length($3)
            }
            END {
                printf "%-*s  %-*s  %-*s  %s\n", qw, "QUESTION", tw, "TYPE", dw, "DEFAULT", "CHOICES"
                for (i = 1; i <= NR; i++)
                    printf "%-*s  %-*s  %-*s  %s\n", qw, q[i], tw, t[i], dw, d[i], c[i]
            }
        ' \
        | sed 's/[[:space:]]*$//'
}

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

# jaia_debconf_set <question> <value>
# debconf itself does not check a value against the template's Choices, and an
# out-of-range value would silently generate the wrong systemd services rather
# than failing, so validate here.
jaia_debconf_set() {
    local question="$1" value="$2"
    local choices type reply element

    if [ $# -lt 2 ]; then
        echo "ERROR: usage: jaia_debconf_set <question> <value>" >&2
        return 1
    fi

    type=$(jaia_debconf_template_field "${question}" Type) || return 1
    if [ -z "${type}" ]; then
        echo "ERROR: ${JAIA_DEBCONF_PACKAGE}/${question} is not a known debconf question." >&2
        return 1
    fi

    choices=$(jaia_debconf_template_field "${question}" Choices)
    if [ -n "${choices}" ]; then
        # a multiselect answer is a comma-separated subset of Choices
        local IFS=,
        for element in ${value}; do
            element="$(echo "${element}" | sed 's/^ *//; s/ *$//')"
            if ! echo "${choices}" | tr ',' '\n' | sed 's/^ *//; s/ *$//' \
                    | grep -qxF "${element}"; then
                unset IFS
                echo "ERROR: '${element}' is not a valid value for ${JAIA_DEBCONF_PACKAGE}/${question}." >&2
                echo "       Choices: $(jaia_debconf_collapse_choices "${choices}")" >&2
                return 1
            fi
        done
        unset IFS
    fi

    reply=$(printf 'SET %s/%s %s\nFSET %s/%s seen true\n' \
                   "${JAIA_DEBCONF_PACKAGE}" "${question}" "${value}" \
                   "${JAIA_DEBCONF_PACKAGE}" "${question}" \
                | debconf-communicate "${JAIA_DEBCONF_PACKAGE}" 2>&1)

    # one reply line per command; anything not starting with 0 is an error
    if echo "${reply}" | grep -qv '^0'; then
        echo "ERROR: could not set ${JAIA_DEBCONF_PACKAGE}/${question}: ${reply}" >&2
        return 1
    fi
}

# jaia_debconf_reconfigure
# Re-runs the package's .config and postinst, which is what regenerates the
# systemd units from the new answers.
jaia_debconf_reconfigure() {
    dpkg-reconfigure -f noninteractive "${JAIA_DEBCONF_PACKAGE}"
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

jaia_debconf_usage() {
    cat >&2 <<EOF
Usage: $(basename "$0") get <question> [default]
       $(basename "$0") set <question> <value> [--no-reconfigure]
       $(basename "$0") list [--all]
       $(basename "$0") selections

Questions are given without the '${JAIA_DEBCONF_PACKAGE}/' prefix, e.g. 'fleet_id'.
'list' shows which ones exist, along with their type, default and choices.

'set' runs 'dpkg-reconfigure ${JAIA_DEBCONF_PACKAGE}' afterwards so that the
systemd units are regenerated from the new value; pass --no-reconfigure to
change the database without applying it (e.g. when setting several values).
EOF
}

# When executed rather than sourced, dispatch on the subcommand.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    subcommand="$1"
    shift 2>/dev/null

    case "${subcommand}" in
        get)
            [ $# -ge 1 ] || { jaia_debconf_usage; exit 1; }
            jaia_debconf_get "$@"
            ;;
        set)
            reconfigure=true
            args=()
            for arg in "$@"; do
                if [ "${arg}" = "--no-reconfigure" ]; then
                    reconfigure=false
                else
                    args+=("${arg}")
                fi
            done

            [ ${#args[@]} -eq 2 ] || { jaia_debconf_usage; exit 1; }
            jaia_debconf_set "${args[@]}" || exit 1
            echo "Set ${JAIA_DEBCONF_PACKAGE}/${args[0]} to '${args[1]}'"

            if [ "${reconfigure}" = "true" ]; then
                echo "Reconfiguring ${JAIA_DEBCONF_PACKAGE} ..."
                jaia_debconf_reconfigure
            else
                echo "Not reconfigured: run 'sudo dpkg-reconfigure ${JAIA_DEBCONF_PACKAGE}' to apply."
            fi
            ;;
        list)
            jaia_debconf_list "$@"
            ;;
        selections)
            jaia_debconf_selections
            ;;
        *)
            jaia_debconf_usage
            exit 1
            ;;
    esac
fi
