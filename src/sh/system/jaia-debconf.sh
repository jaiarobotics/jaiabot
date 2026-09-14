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
# Requires root. The subcommands read the on-disk database, which debconf only
# writes once a running maintainer script has exited, so a maintainer script
# must use its own db_get rather than these.

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

    local_copy="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../../debian/${JAIA_DEBCONF_PACKAGE}.templates"
    if [ -r "${local_copy}" ]; then
        echo "${local_copy}"
        return 0
    fi

    echo "ERROR: ${JAIA_DEBCONF_PACKAGE}.templates not found at ${installed} or ${local_copy}" >&2
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

# jaia_debconf_questions [include_internal]
# Every question the package defines, one per line, sorted.
#
# The debconf_state_* questions record where the interactive dpkg-reconfigure
# menu is rather than any configuration, so they are left out unless the caller
# passes "true".
jaia_debconf_questions() {
    local include_internal="${1:-false}" templates

    templates=$(jaia_debconf_templates_file) || return 1

    awk -v pkg="${JAIA_DEBCONF_PACKAGE}" -v include_internal="${include_internal}" '
        # an error template is a message shown to the user, not a question with an answer
        function flush() {
            if (q != "" && type != "error")
                print q
            q = ""; type = ""
        }
        /^Template:/ {
            flush()
            q = $2
            sub("^" pkg "/", "", q)
            # debconf_state_* track where the interactive menu is, they are not
            # configuration, so hide them unless asked for
            if (include_internal != "true" && q ~ /^debconf_state_/)
                q = ""
            next
        }
        /^Type:/ {
            type = substr($0, index($0, ":") + 1)
            gsub(/^ +| +$/, "", type)
            next
        }
        END { flush() }
    ' "${templates}" | sort
}

# jaia_debconf_table <header>...
# Pads tab-separated rows on stdin into aligned columns under the given headers,
# so 'list' and 'get' (with no question) come out looking the same.
jaia_debconf_table() {
    local headers
    headers=$(printf '%s\t' "$@")

    awk -F'\t' -v headers="${headers}" '
        BEGIN {
            nh = split(headers, H, "\t")
            # the trailing \t from printf leaves an empty final element
            while (nh > 0 && H[nh] == "")
                nh--
            for (i = 1; i <= nh; i++) w[i] = length(H[i])
        }
        {
            for (i = 1; i <= nh; i++) {
                row[NR, i] = $i
                if (length($i) > w[i]) w[i] = length($i)
            }
        }
        END {
            line = ""
            for (i = 1; i <= nh; i++)
                line = line sprintf("%-*s%s", w[i], H[i], (i < nh ? "  " : ""))
            print line
            for (r = 1; r <= NR; r++) {
                line = ""
                for (i = 1; i <= nh; i++)
                    line = line sprintf("%-*s%s", w[i], row[r, i], (i < nh ? "  " : ""))
                print line
            }
        }
    ' | sed 's/[[:space:]]*$//'
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
    awk -v pkg="${JAIA_DEBCONF_PACKAGE}" -v include_internal="${include_internal}" '
        # value of "Field: value", empty when the field has none
        function value(   v) {
            v = substr($0, index($0, ":") + 1)
            gsub(/^ +| +$/, "", v)
            return v
        }
        function flush() {
            # an error template is a message shown to the user, not something to set
            if (question != "" && type != "error")
                printf "%s\t%s\t%s\t%s\n", question, type, dflt, choices
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
        | jaia_debconf_table QUESTION TYPE DEFAULT CHOICES
}

# jaia_debconf_get <question> [default]
# Fails if the question is unanswered and no default was supplied.
jaia_debconf_get() {
    local question="${1-}"
    local default="${2-}"
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

# jaia_debconf_json
# Turns the question<TAB>set|unset<TAB>value rows on stdin into a JSON object,
# with unanswered questions as null so that they stay distinct from a question
# deliberately set to the empty string.
jaia_debconf_json() {
    awk -F'\t' '
        function escape(s) {
            gsub(/\\/, "\\\\", s)
            gsub(/"/, "\\\"", s)
            gsub(/\t/, "\\t", s)
            gsub(/\r/, "\\r", s)
            gsub(/\n/, "\\n", s)
            return s
        }
        BEGIN { printf "{" }
        {
            printf "%s\n    \"%s\": %s", (NR > 1 ? "," : ""), escape($1),
                   ($2 == "unset" ? "null" : "\"" escape($3) "\"")
        }
        END { printf "%s}\n", (NR ? "\n" : "") }
    '
}

# jaia_debconf_pairs [include_internal]
# question<TAB>set|unset<TAB>value for every question, one per line.
jaia_debconf_pairs() {
    local include_internal="${1:-false}" questions replies

    questions=$(jaia_debconf_questions "${include_internal}") || return 1
    if [ -z "${questions}" ]; then
        echo "ERROR: no questions found in the ${JAIA_DEBCONF_PACKAGE} templates." >&2
        return 1
    fi

    # One debconf-communicate session for the whole set rather than one per
    # question; replies come back in order, one line per GET.
    replies=$(while IFS= read -r question; do
                  echo "GET ${JAIA_DEBCONF_PACKAGE}/${question}"
              done <<< "${questions}" \
              | debconf-communicate "${JAIA_DEBCONF_PACKAGE}" 2>/dev/null)

    if [ -z "${replies}" ]; then
        echo "ERROR: could not read the ${JAIA_DEBCONF_PACKAGE} debconf database." >&2
        echo "       Reading it requires root." >&2
        return 1
    fi

    # replies are "0 <value>" when answered, or a non-zero code with a message
    paste <(echo "${questions}") <(echo "${replies}") \
        | awk -F'\t' '
            {
                answered = ($2 ~ /^0( |$)/)
                printf "%s\t%s\t%s\n", $1, (answered ? "set" : "unset"),
                       (answered ? substr($2, 3) : "")
            }
        '
}

# jaia_debconf_get_all [--all] [--json]
# Every question's current value, laid out like 'list'. This is what 'get' does
# when given no question: 'list' says what can be set, this says what is set.
#
# Unlike 'selections' - which emits debconf-set-selections format for machines
# to re-import - this is for reading, and it includes questions that have never
# been answered, marked "(unset)".
jaia_debconf_get_all() {
    local include_internal=false json=false pairs

    while [ $# -gt 0 ]; do
        case "$1" in
            --all)  include_internal=true ;;
            --json) json=true ;;
            *)
                echo "ERROR: usage: jaia_debconf_get_all [--all] [--json]" >&2
                return 1
                ;;
        esac
        shift
    done

    pairs=$(jaia_debconf_pairs "${include_internal}") || return 1

    if [ "${json}" = "true" ]; then
        echo "${pairs}" | jaia_debconf_json
    else
        echo "${pairs}" \
            | awk -F'\t' '{ printf "%s\t%s\n", $1, ($2 == "unset" ? "(unset)" : $3) }' \
            | jaia_debconf_table QUESTION VALUE
    fi
}

# jaia_debconf_range_flag <question>
# The 'jaia_bounds' flag holding a question's valid range, for the questions whose answers are too
# many to list as Choices. Fails for every other question.
jaia_debconf_range_flag() {
    case "$1" in
        bot_id|fleet_id|hub_id) echo "--$1" ;;
        *) return 1 ;;
    esac
}

# jaia_debconf_set <question> <value>
# debconf itself does not check a value against the template's Choices, and an
# out-of-range value would silently generate the wrong systemd services rather
# than failing, so validate here.
jaia_debconf_set() {
    local choices type reply element range_flag min max valid

    if [ $# -lt 2 ]; then
        echo "ERROR: usage: jaia_debconf_set <question> <value>" >&2
        return 1
    fi

    local question="$1" value="$2"

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
                echo "       Choices: ${choices}" >&2
                return 1
            fi
        done
        unset IFS
    elif range_flag=$(jaia_debconf_range_flag "${question}"); then
        min=$(jaia_bounds "${range_flag}" --min) || return 1
        max=$(jaia_bounds "${range_flag}" --max) || return 1

        valid=false
        case "${value}" in
            ''|*[!0-9]*) ;;
            *) if [ "${value}" -ge "${min}" ] && [ "${value}" -le "${max}" ]; then valid=true; fi ;;
        esac

        if [ "${valid}" = "false" ]; then
            echo "ERROR: '${value}' is not a valid value for ${JAIA_DEBCONF_PACKAGE}/${question}." >&2
            echo "       Range: ${min} to ${max}" >&2
            return 1
        fi
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
Usage: $(basename "$0") get [<question> [default]] [--all] [--json]
       $(basename "$0") set <question> <value> [--no-reconfigure]
       $(basename "$0") list [--all]
       $(basename "$0") selections

Questions are given without the '${JAIA_DEBCONF_PACKAGE}/' prefix, e.g. 'fleet_id'.
'list' shows which ones exist, along with their type, default and choices;
'get' with no question shows what they are all currently set to.

'get --json' writes a JSON object of question to value for machines to consume,
with unanswered questions as null.

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
            json=false
            args=()
            for arg in "$@"; do
                case "${arg}" in
                    --json) json=true ;;
                    *)      args+=("${arg}") ;;
                esac
            done

            # no question means "show me everything"
            if [ ${#args[@]} -eq 0 ] || [ "${args[0]}" = "--all" ]; then
                [ "${json}" = "true" ] && args+=("--json")
                jaia_debconf_get_all "${args[@]}"
            elif [ "${json}" = "true" ]; then
                value=$(jaia_debconf_get "${args[@]}") || exit 1
                printf '%s\tset\t%s\n' "${args[0]}" "${value}" | jaia_debconf_json
            else
                jaia_debconf_get "${args[@]}"
            fi
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
