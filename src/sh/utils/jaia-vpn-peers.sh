#!/bin/bash

# Peer administration for a WireGuard server interface.
#
# Each peer is a file of its own, and a change is applied with "wg syncconf",
# which wg(8) defines as making only the differences and so leaving established
# sessions alone. Restarting the interface to pick up a peer would instead drop
# HUB2HUB and every live session on the CloudHub, and a shared file would make
# revoking one peer a rewrite of every other peer's entry.

set -u -e

# Overridable so this can be run against a directory other than the live one.
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"

# Named here rather than in the function that makes it, because the trap body
# runs once that function has returned.
TMPFILE=""
trap '[ -z "${TMPFILE}" ] || rm -f "${TMPFILE}"' EXIT

usage()
{
    cat >&2 <<EOF
Usage: ${0##*/} add <interface> <name> <public key> <allowed ips>
       ${0##*/} remove <interface> <name>
       ${0##*/} list <interface>
       ${0##*/} apply <interface>
       ${0##*/} migrate <interface>

Names a peer file, so <name> may hold only letters, digits, '-' and '_'.
"apply" reloads the directory onto a running interface and is what the
interface's PostUp runs; it does nothing if the interface is down.
"migrate" moves the peers of an interface still kept in one flat config
into the directory.
EOF
    exit 1
}

peers_dir()
{
    echo "${WG_DIR}/$1.peers.d"
}

check_name()
{
    case "$1" in
        "" | *[!A-Za-z0-9_-]*)
            echo "ERROR: peer name '$1' may hold only letters, digits, '-' and '_'" >&2
            exit 1
            ;;
    esac
}

assemble()
{
    local iface=$1 peer
    wg-quick strip "${WG_DIR}/${iface}.conf"
    for peer in "$(peers_dir "$iface")"/*.conf; do
        [ -e "$peer" ] || continue
        cat "$peer"
    done
}

# A peer added while the interface is down needs no apply: PostUp reads the
# directory when it comes up.
cmd_apply()
{
    local iface=$1
    wg show "$iface" >/dev/null 2>&1 || return 0

    # Carries the interface's private key, so it is written beside the config it
    # came from rather than anywhere more widely readable.
    TMPFILE=$(mktemp "${WG_DIR}/.${iface}.syncconf.XXXXXX")
    assemble "$iface" > "$TMPFILE"
    wg syncconf "$iface" "$TMPFILE"
    rm -f "$TMPFILE"
    TMPFILE=""
}

cmd_add()
{
    local iface=$1 name=$2 pubkey=$3 allowed_ips=$4 dir peer
    check_name "$name"

    dir=$(peers_dir "$iface")
    mkdir -p "$dir"
    chmod 700 "$dir"

    peer="${dir}/${name}.conf"
    if [ -e "$peer" ]; then
        echo "ERROR: ${name} is already a peer of ${iface}; remove it first" >&2
        exit 1
    fi

    cat > "$peer" <<EOF
[Peer]
PublicKey = ${pubkey}
AllowedIPs = ${allowed_ips}
EOF

    # Keeps the directory and the running interface agreeing on who is a peer.
    if ! cmd_apply "$iface"; then
        rm -f "$peer"
        echo "ERROR: could not apply ${name} to ${iface}; it was not added" >&2
        exit 1
    fi
}

cmd_remove()
{
    local iface=$1 name=$2 peer
    check_name "$name"

    peer="$(peers_dir "$iface")/${name}.conf"
    if [ ! -e "$peer" ]; then
        echo "ERROR: ${name} is not a peer of ${iface}" >&2
        exit 1
    fi

    rm -f "$peer"
    cmd_apply "$iface"
}

cmd_list()
{
    local peer
    for peer in "$(peers_dir "$1")"/*.conf; do
        [ -e "$peer" ] || continue
        peer=${peer##*/}
        echo "${peer%.conf}"
    done
}

# A peer whose section header carries anything but "[Peer]" is left in the flat
# config rather than guessed at, so a config this does not understand keeps
# working as it did.
cmd_migrate()
{
    local iface=$1 conf dir
    conf="${WG_DIR}/${iface}.conf"
    [ -f "$conf" ] || { echo "ERROR: no ${conf} to migrate" >&2; exit 1; }

    dir=$(peers_dir "$iface")
    mkdir -p "$dir"
    chmod 700 "$dir"

    TMPFILE=$(mktemp "${WG_DIR}/.${iface}.migrate.XXXXXX")

    awk -v dir="$dir" '
        function valid(candidate) { return candidate ~ /^[A-Za-z0-9_-]+$/ }
        function flush(   i, out) {
            if (!collecting) return
            if (!valid(name)) name = sprintf("peer-%d", count)
            out = dir "/" name ".conf"
            printf "" > out
            for (i = 1; i <= held; i++) print lines[i] > out
            close(out)
            collecting = 0
            held = 0
            name = ""
        }
        BEGIN { collecting = 0; held = 0; count = 0; name = ""; marked = "" }
        /^[ \t]*#[ \t]*BEGIN PEER[ \t]/ {
            marked = $0
            sub(/^.*BEGIN PEER[ \t]+/, "", marked)
            sub(/:.*$/, "", marked)
            gsub(/[ \t]+/, "", marked)
            next
        }
        /^[ \t]*#[ \t]*END PEER[ \t]/ { flush(); next }
        /^[ \t]*\[[Pp]eer\][ \t]*$/ {
            flush()
            collecting = 1
            count++
            name = marked
            marked = ""
            lines[++held] = "[Peer]"
            next
        }
        /^[ \t]*\[/ { flush() }
        { if (collecting) lines[++held] = $0; else print }
        END { flush() }
    ' "$conf" > "$TMPFILE"

    # Into [Interface], not at the end: a peer this did not understand is still
    # down there, and a PostUp below it would belong to that peer instead.
    if ! grep -q 'jaia-vpn-peers.sh apply' "$TMPFILE"; then
        if ! awk '
            { print }
            /^[ \t]*\[[Ii]nterface\][ \t]*$/ && !added {
                print "PostUp = jaia-vpn-peers.sh apply %i"
                added = 1
            }
            END { exit added ? 0 : 1 }
        ' "$TMPFILE" > "${TMPFILE}.hook"; then
            rm -f "${TMPFILE}.hook"
            echo "ERROR: ${conf} has no [Interface] section" >&2
            exit 1
        fi
        mv "${TMPFILE}.hook" "$TMPFILE"
    fi

    chmod --reference="$conf" "$TMPFILE"
    mv "$TMPFILE" "$conf"
    TMPFILE=""
}

[ $# -ge 1 ] || usage
action=$1
shift

case "$action" in
    add)     [ $# -eq 4 ] || usage; cmd_add "$@" ;;
    remove)  [ $# -eq 2 ] || usage; cmd_remove "$@" ;;
    list)    [ $# -eq 1 ] || usage; cmd_list "$@" ;;
    apply)   [ $# -eq 1 ] || usage; cmd_apply "$@" ;;
    migrate) [ $# -eq 1 ] || usage; cmd_migrate "$@" ;;
    *)       usage ;;
esac
