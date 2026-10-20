#!/bin/bash

# What can be checked of a new CloudHub. From outside: every site serves a valid
# certificate and answers the way it should, and SSH is closed unless fleet pairing
# is open. With --ssh, while fleet pairing is open: its services, its release, and
# whether the REST API JCC talks to has loaded.

usage()
{
    echo "Usage: $0 <base uri> [--ssh]"
    exit 2
}

[ $# -ge 1 ] || usage
BASE_URI=$1
SSH=false
[ "${2:-}" = "--ssh" ] && SSH=true

failures=0
ok() { echo "ok    $*"; }
fail() { echo "FAIL  $*"; failures=$((failures + 1)); }

# Signed in, each is a page; signed out, each sends the browser to auth. for its
# login, and auth. itself answers. A 502 from sim. means no VirtualFleet is running.
for site in "" run. auth. users. support. sim.; do
    url="https://${site}${BASE_URI}/"
    result=$(curl -sS -m 15 -o /dev/null -w '%{http_code} %{ssl_verify_result}' "$url" 2>&1 | tail -1)
    read -r code verify <<<"$result"
    if [ "$verify" != 0 ]; then
        fail "$url: no valid certificate yet (${result})"
    elif [[ "$code" =~ ^(200|302)$ ]]; then
        ok "$url: $code, certificate valid"
    elif [ "$site" = sim. ] && [ "$code" = 502 ]; then
        ok "$url: 502 (no VirtualFleet running), certificate valid"
    else
        fail "$url: HTTP $code"
    fi
done

expiry=$(echo | openssl s_client -connect "${BASE_URI}:443" -servername "$BASE_URI" 2>/dev/null \
             | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
[ -n "$expiry" ] && echo "note  certificate for $BASE_URI expires $expiry"

if nc -z -w 5 "$BASE_URI" 22 2>/dev/null; then
    echo "note  port 22 is open: fleet pairing (or a support grant) is open"
    port22=open
else
    echo "note  port 22 is closed (fleet pairing closed)"
    port22=closed
fi

if $SSH; then
    if [ "$port22" != open ]; then
        fail "--ssh needs port 22 open: Open Fleet Pairing in the CloudHub's JCU first"
    else
        echo "--- on the CloudHub"
        # A new CloudHub's host key is unknown here, and a rebuilt one's has changed
        ssh_err=$(mktemp)
        ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new \
            "jaia@${BASE_URI}" 'bash -s' 2>"$ssh_err" <<'EOF' || failures=$((failures + 1))
bad=0
echo "note  $(dpkg-query -W -f='jaiabot-embedded ${Version}' jaiabot-embedded 2>/dev/null) on $(lsb_release -cs 2>/dev/null)"
for unit in apache2 caddy authelia lldap jaia_support_portal jaia_support_reconcile.timer jaiabot_web_portal jaiabot_hub_manager; do
    if systemctl is-active --quiet "$unit"; then echo "ok    $unit active"; else echo "FAIL  $unit not active"; bad=1; fi
done
code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
       -d '{"target":{"all":true},"status":true}' http://localhost:8080/jaia/v1)
if [ "$code" = 200 ]; then echo "ok    REST API answers (JCC can reach the CloudHub)"; else
    echo "FAIL  REST API answers $code: JCC will show 'Connection to Hub Dropped' (see /var/log/apache2/error.log)"; bad=1; fi
failed=$(systemctl --failed --no-legend --plain | awk '{print $1}' | tr '\n' ' ')
[ -n "$failed" ] && echo "note  failed units: $failed(grub-initrd-fallback, grub2-common and jaiabot_update_ufw_rules are known and harmless on a CloudHub)"
exit $bad
EOF
        if grep -qiE "host key verification failed|remote host identification has changed" "$ssh_err"; then
            echo "FAIL  ${BASE_URI}'s SSH host key is not the one this workstation recorded: if the CloudHub" \
                 "was rebuilt, 'ssh-keygen -R ${BASE_URI}' and run this again"
        elif [ -s "$ssh_err" ]; then
            sed 's/^/  ssh: /' "$ssh_err"
        fi
        rm -f "$ssh_err"
    fi
fi

echo
if (( failures > 0 )); then
    echo "$failures check(s) failed"
    exit 1
fi
echo "CloudHub checks passed"
