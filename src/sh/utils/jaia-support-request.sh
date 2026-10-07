#!/bin/bash

# Signs a request for support access to a fleet, for the customer to approve.
#
# The signature is the whole point: the CloudHub's support page draws nothing at
# all for a request it cannot verify against Jaia's root keys, so a request
# cannot be forged by anyone who reaches that page, and Jaia cannot grant itself
# access by making one. Signing needs a touch of the Yubikey the key lives on.

set -u -e

NAMESPACE=jaia-support
# Run as 'jaia admin fleet support_request', the jaia tool passes --binary=<its command>
BINARY=${0##*/}
MAX_DAYS=14

usage()
{
    cat >&2 <<EOF
Usage: ${BINARY} --fleet <id> --key <signing key> --reason <text> [--days <n>]
       [--from <address>] [--scopes <list>]

  --fleet <id>      The fleet this asks for access to
  --key <path>      Jaia root key to sign with, e.g. ~/.ssh/id_ed25519_sk.
                    Its public half must be in config/ssh/root_authorized_keys.
  --reason <text>   Shown to the customer, in their terms, not ours
  --days <n>        Days of access asked for (default 7, at most ${MAX_DAYS})
  --from <address>  The address the CloudHub should admit, IP or CIDR. Defaults
                    to this machine's public address. The grant opens port 22 to
                    this and nothing else, so it is what you will connect from.
  --scopes <list>   What to ask for, comma separated (default ${SCOPES}):
                      shell  a shell on the CloudHub, and the fleet through it
                      web    sign-in to JCC, JDV, the JCU and the read-only API
                    Ask for the smaller one when it is enough; the customer can
                    approve either on its own whatever is asked for.

Prints the request for the customer to paste into https://support.<their fleet>.
EOF
    exit 1
}

FLEET=""
KEY=""
REASON=""
DAYS=7
SOURCE=""
SCOPES=shell

while (( $# > 0 )); do
    case "$1" in
        --binary=*) BINARY="${1#*=}"; shift ;;
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --key) KEY="${2:-}"; shift 2 ;;
        --reason) REASON="${2:-}"; shift 2 ;;
        --days) DAYS="${2:-}"; shift 2 ;;
        --from) SOURCE="${2:-}"; shift 2 ;;
        --scopes) SCOPES="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

[ -n "$FLEET" ] && [ -n "$KEY" ] && [ -n "$REASON" ] || usage

case "$FLEET" in "" | *[!0-9]*) echo "ERROR: fleet '${FLEET}' is not a number" >&2; exit 1 ;; esac
case "$DAYS" in "" | *[!0-9]*) echo "ERROR: days '${DAYS}' is not a number" >&2; exit 1 ;; esac

# Capped here as well as on the CloudHub: a request that cannot be honoured is
# better refused where it is made than after the customer has approved it.
if (( DAYS < 1 || DAYS > MAX_DAYS )); then
    echo "ERROR: days must be between 1 and ${MAX_DAYS}, not ${DAYS}" >&2
    exit 1
fi

[ -r "$KEY" ] || { echo "ERROR: cannot read signing key ${KEY}" >&2; exit 1; }

# Refused here rather than silently narrowed: a typo that asked for less than the
# engineer meant would surface as a second call to the customer, not as an error.
for scope in ${SCOPES//,/ }; do
    case "$scope" in
        shell|web) ;;
        *) echo "ERROR: unknown scope '${scope}' - expected shell or web" >&2; exit 1 ;;
    esac
done
[ -n "$SCOPES" ] || { echo "ERROR: --scopes cannot be empty" >&2; exit 1; }

# Asked of the network rather than guessed, because a wrong answer here produces
# a grant that admits somewhere you are not
if [ -z "$SOURCE" ]; then
    SOURCE=$(curl -fsS --max-time 10 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]')
    [ -n "$SOURCE" ] || {
        echo "ERROR: could not work out this machine's public address." >&2
        echo "       Pass it with --from <address>." >&2
        exit 1
    }
    echo ">>> Asking for access from ${SOURCE}" >&2
fi

# Said plainly here because an older CloudHub ignores the field and grants the shell
# alone: the engineer should be able to see the mismatch in the text they are sending
echo ">>> Asking for: ${SCOPES}" >&2

python3 -c 'import ipaddress,sys; ipaddress.ip_network(sys.argv[1], strict=False)' "$SOURCE" 2>/dev/null || {
    echo "ERROR: --from '${SOURCE}' is not an IP address or CIDR" >&2
    exit 1
}

# A request is for one fleet, for one window, and cannot be replayed into
# another: the CloudHub checks the fleet and the expiry it was signed with.
requested_at=$(date -u +%s)
scopes_json=$(printf '%s' "$SCOPES" | python3 -c 'import json,sys; print(json.dumps([s for s in sys.stdin.read().split(",") if s]))')
payload=$(printf '{"fleet":%s,"days":%s,"requested_at":%s,"expires_at":%s,"source":%s,"scopes":%s,"reason":%s}' \
                 "$FLEET" "$DAYS" "$requested_at" "$(( requested_at + DAYS * 86400 ))" \
                 "$(printf '%s' "$SOURCE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
                 "$scopes_json" \
                 "$(printf '%s' "$REASON" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")

TMPDIR_REQ=$(mktemp -d)
trap 'rm -rf "${TMPDIR_REQ}"' EXIT
printf '%s' "$payload" > "${TMPDIR_REQ}/payload"

echo ">>> Touch the Yubikey to sign this request" >&2
ssh-keygen -Y sign -f "$KEY" -n "$NAMESPACE" -q "${TMPDIR_REQ}/payload"

printf -- '-----BEGIN JAIA SUPPORT REQUEST-----\n'
printf '%s\n' "$payload"
cat "${TMPDIR_REQ}/payload.sig"
printf -- '-----END JAIA SUPPORT REQUEST-----\n'
