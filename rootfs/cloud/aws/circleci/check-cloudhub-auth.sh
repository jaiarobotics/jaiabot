#!/bin/bash

# Checks that a CloudHub's authentication front end is actually serving: the Authelia
# portal answers, and JCC behind it does not answer to an unauthenticated request.
#
# Caddy fails ACME quietly in the background rather than refusing to start, so without
# this a CloudHub whose front end never came up still looks healthy from the outside.

usage() {
    cat <<EOF
Usage: $0 [options]

  --fleet <n>        Fleet ID (default: 9)
  --base-uri <s>     CloudHub auth base URI (default: fleet<n>.ci.invalid)
  --host <s>         Host to reach the CloudHub on (default: cloudhub-fleet<n>)
  --attempts <n>     How many times to poll for the portal (default: 60)
  --interval <n>     Seconds between attempts (default: 10)
  --result-file <s>  Write the observed statuses here as well as to stdout
EOF
    exit 1
}

set -u -e

FLEET=9
BASE_URI=""
CLOUDHUB=""
ATTEMPTS=60
INTERVAL=10
RESULT_FILE=""

while (( $# > 0 )); do
    case "$1" in
        --fleet) FLEET="${2:-}"; shift 2 ;;
        --base-uri) BASE_URI="${2:-}"; shift 2 ;;
        --host) CLOUDHUB="${2:-}"; shift 2 ;;
        --attempts) ATTEMPTS="${2:-}"; shift 2 ;;
        --interval) INTERVAL="${2:-}"; shift 2 ;;
        --result-file) RESULT_FILE="${2:-}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

BASE_URI="${BASE_URI:-fleet${FLEET}.ci.invalid}"
CLOUDHUB="${CLOUDHUB:-cloudhub-fleet${FLEET}}"

function on_cloudhub() {
    ssh -o StrictHostKeyChecking=no "jaia@${CLOUDHUB}" "$@"
}

# A reserved domain resolves nowhere and Caddy signs it with its own CA, so curl is
# pointed at the loopback with the right Host and told not to verify
function status_of() {
    on_cloudhub "curl -sS -k -o /dev/null -w '%{http_code}' --max-time 10 \
                   --resolve $1.${BASE_URI}:443:127.0.0.1 https://$1.${BASE_URI}/"
}

# Printed rather than archived: a redirect into the artifacts directory reached the
# artifacts empty twice, while the step log came through both times
function diagnostics() {
    local unit
    for unit in authelia lldap caddy docker; do
        echo "===== systemctl status ${unit} ====="
        on_cloudhub "systemctl status --no-pager -l ${unit}" 2>&1 || true
        echo "===== journal ${unit} ====="
        on_cloudhub "sudo journalctl -u ${unit} --no-pager -n 150" 2>&1 || true
    done
    echo "===== docker ====="
    on_cloudhub "sudo docker ps -a; sudo docker info 2>&1 | head -30" 2>&1 || true
    echo "===== listening ====="
    on_cloudhub "sudo ss -lntp" 2>&1 || true
    echo "===== cloud-init ====="
    on_cloudhub "sudo journalctl -u cloud-final --no-pager -n 300" 2>&1 || true
}

portal=""
for attempt in $(seq 1 "${ATTEMPTS}"); do
    portal=$(status_of auth || true)
    [ "${portal}" = "200" ] && break

    # Restart=on-failure keeps a crash-looping unit in activating rather than failed,
    # so the restart count is the only place the loop shows up
    restarts=$(on_cloudhub "systemctl show authelia -p NRestarts --value" 2>/dev/null || echo 0)
    if [ "${restarts:-0}" -gt 5 ] 2>/dev/null; then
        echo "attempt ${attempt}: authelia has restarted ${restarts} times; not waiting out the window"
        break
    fi

    echo "attempt ${attempt}: auth portal returned '${portal}', waiting"
    sleep "${INTERVAL}"
done

protected=$(status_of run || true)
result="auth portal: ${portal}, protected JCC: ${protected}"
echo "${result}"
if [ -n "${RESULT_FILE}" ]; then echo "${result}" > "${RESULT_FILE}"; fi

if [ "${portal}" != "200" ]; then
    diagnostics
    echo "ERROR: Authelia portal did not come up behind Caddy" >&2
    exit 1
fi

# forward_auth turns Authelia's refusal into a redirect to the portal, or passes the
# 401 through; what it must never do is serve JCC to a request that has neither
case "${protected}" in
    200) diagnostics; echo "ERROR: JCC served without authentication" >&2; exit 1 ;;
    30[0-9]|401) echo "JCC is protected (${protected})" ;;
    *) diagnostics; echo "ERROR: unexpected status ${protected} from protected JCC" >&2; exit 1 ;;
esac
