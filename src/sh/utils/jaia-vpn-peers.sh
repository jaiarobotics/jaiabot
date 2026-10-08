#!/bin/bash

# Peer administration for a WireGuard server interface.
#
# Each peer is a file of its own, and a change is applied with "wg syncconf",
# which wg(8) defines as making only the differences and so leaving established
# sessions alone. Restarting the interface to pick up a peer would instead drop
# HUB2HUB and every live session on the CloudHub, and a shared file would make
# revoking one peer a rewrite of every other peer's entry.

set -u -e

# Overridable so this can be run against directories other than the live ones.
WG_DIR="${JAIA_WG_DIR:-/etc/wireguard}"
SYSTEMD_DIR="${JAIA_SYSTEMD_DIR:-/etc/systemd/system}"

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
       ${0##*/} status <interface>
       ${0##*/} apply <interface>
       ${0##*/} enable <interface>
       ${0##*/} migrate <interface> [<address prefix to drop>...]

Names a peer file, so <name> may hold only letters, digits, '-' and '_'.
"status" lists each peer with its last handshake. "apply" reloads the
directory onto a running interface; it does nothing if the interface is
down. "enable" has the interface's wg-quick unit run it
once the interface is up and on reload. "migrate" moves the peers of an
interface still kept in one flat config into the directory, and enables it;
a peer whose AllowedIPs begin with a given prefix is dropped instead.
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

# A peer added while the interface is down needs no apply: the unit reads the
# directory when the interface comes up.
cmd_apply()
{
    local iface=$1 assembled
    wg show "$iface" >/dev/null 2>&1 || return 0

    # Kept in memory: the text carries the private key, and this runs as the
    # interface comes up, when a write would make its peers depend on /etc being
    # writable.
    assembled=$(assemble "$iface")
    wg syncconf "$iface" <(printf '%s\n' "${assembled}")
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

# For a person to read: each peer and how long ago it last completed a handshake
cmd_status()
{
    local iface=$1 handshakes now peer name pubkey when
    handshakes=$(wg show "$iface" latest-handshakes 2>/dev/null || true)
    now=$(date +%s)
    for peer in "$(peers_dir "$iface")"/*.conf; do
        [ -e "$peer" ] || continue
        name=${peer##*/}
        name=${name%.conf}
        pubkey=$(sed -n 's/^[[:space:]]*PublicKey[[:space:]]*=[[:space:]]*//p' "$peer" | head -n 1)
        when=$(awk -v key="$pubkey" '$1 == key { print $2 }' <<<"$handshakes")
        if [ -z "$when" ] || [ "$when" = 0 ]; then
            echo "${name} never"
        else
            echo "${name} $((now - when))s ago"
        fi
    done
}

# A peer whose section header carries anything but "[Peer]" is left in the flat
# config rather than guessed at, so a config this does not understand keeps
# working as it did.
cmd_migrate()
{
    local iface=$1 conf dir
    shift
    # Peers whose AllowedIPs begin with one of these are dropped rather than moved
    local drop="$*"
    conf="${WG_DIR}/${iface}.conf"
    [ -f "$conf" ] || { echo "ERROR: no ${conf} to migrate" >&2; exit 1; }

    dir=$(peers_dir "$iface")
    mkdir -p "$dir"
    chmod 700 "$dir"

    TMPFILE=$(mktemp "${WG_DIR}/.${iface}.migrate.XXXXXX")

    awk -v dir="$dir" -v drop="$drop" '
        function valid(candidate) { return candidate ~ /^[A-Za-z0-9_-]+$/ }
        function dropped(   i, j, n, prefixes, line, ips, m, k) {
            n = split(drop, prefixes, " ")
            for (i = 1; i <= held; i++) {
                line = lines[i]
                if (line !~ /^[ \t]*AllowedIPs[ \t]*=/) continue
                sub(/^[^=]*=[ \t]*/, "", line)
                m = split(line, ips, /[ \t]*,[ \t]*/)
                for (k = 1; k <= m; k++)
                    for (j = 1; j <= n; j++)
                        if (index(ips[k], prefixes[j]) == 1) return ips[k]
            }
            return ""
        }
        function flush(   i, out, ip) {
            if (!collecting) return
            ip = dropped()
            if (ip != "") {
                print "dropped the peer at " ip > "/dev/stderr"
                collecting = 0
                held = 0
                name = ""
                return
            }
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

    # A hook left by an earlier build of this script, which wg-quick cannot run
    sed -i '/^[[:space:]]*PostUp[[:space:]]*=[[:space:]]*jaia-vpn-peers\.sh apply %i[[:space:]]*$/d' "$TMPFILE"

    chmod --reference="$conf" "$TMPFILE"
    mv "$TMPFILE" "$conf"
    TMPFILE=""

    cmd_enable "$iface"
}

# Run by systemd rather than from the config's PostUp: Ubuntu confines wg-quick
# with an AppArmor profile that will not let it execute this script, and the
# stock ExecReload syncs the config alone, which would drop every directory peer.
cmd_enable()
{
    local iface=$1 dir
    dir="${SYSTEMD_DIR}/wg-quick@${iface}.service.d"
    mkdir -p "$dir"
    cat > "${dir}/jaia-peers.conf" <<EOF
[Service]
ExecStartPost=/usr/bin/jaia-vpn-peers.sh apply %i
ExecReload=
ExecReload=/usr/bin/jaia-vpn-peers.sh apply %i
EOF
    # The unit reads the drop-in at the next boot regardless
    systemctl daemon-reload 2>/dev/null || true
}

[ $# -ge 1 ] || usage
action=$1
shift

case "$action" in
    add)     [ $# -eq 4 ] || usage; cmd_add "$@" ;;
    remove)  [ $# -eq 2 ] || usage; cmd_remove "$@" ;;
    list)    [ $# -eq 1 ] || usage; cmd_list "$@" ;;
    status)  [ $# -eq 1 ] || usage; cmd_status "$@" ;;
    enable)  [ $# -eq 1 ] || usage; cmd_enable "$@" ;;
    apply)   [ $# -eq 1 ] || usage; cmd_apply "$@" ;;
    migrate) [ $# -ge 1 ] || usage; cmd_migrate "$@" ;;
    *)       usage ;;
esac
