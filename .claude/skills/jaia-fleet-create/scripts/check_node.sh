#!/bin/bash

# Checks one bot or hub over SSH: that it is the node the fleet config says, is
# running, can talk, and - once paired - is on the CloudHub's VPN.

usage()
{
    echo "Usage: $0 <node address, e.g. 10.23.9.11> [--paired]"
    exit 2
}

[ $# -ge 1 ] || usage
NODE=$1
PAIRED=false
[ "${2:-}" = "--paired" ] && PAIRED=true

ssh -o BatchMode=yes -o ConnectTimeout=15 "jaia@${NODE}" "PAIRED=${PAIRED} bash -s" <<'EOF'
bad=0
ok() { echo "ok    $*"; }
fail() { echo "FAIL  $*"; bad=1; }

. /etc/jaiabot/jaia.env 2>/dev/null
type=${jaia_type:-?}
id=$(eval echo "\${jaia_${type}_id:-?}")
echo "note  $(hostname): ${type} ${id} of fleet ${jaia_fleet_id:-?}, $(dpkg-query -W -f='jaiabot-embedded ${Version}' jaiabot-embedded 2>/dev/null)"

stopped=$(systemctl list-units 'jaiabot*' --all --no-legend --plain | awk '$3!="active"{print $1}' \
          | grep -v -e jaiabot_goby_liaison_standalone | tr '\n' ' ')
[ -z "$stopped" ] && ok "every jaiabot unit is running" || fail "not running: $stopped"

# A configured radio that never answers keeps goby_intervehicle_portal from
# reporting ready, and the hub then publishes nothing: JCC shows no node
comms=$(jaia admin debconf get 2>/dev/null | awk '/^comms_links/{print $2}')
timeouts=$(journalctl -u jaiabot_goby_intervehicle_portal --since -10min --no-pager 2>/dev/null | grep -c "ERROR Result: timeout")
if [ "${timeouts:-0}" -gt 5 ]; then
    fail "the intervehicle portal timed out on its XBee ${timeouts} times in 10 min (comms_links: ${comms}): no radio fitted? set comms_links to wifi"
else
    ok "comms links ${comms:-?} are working"
fi

if [ "$type" = hub ]; then
    # The first health report takes a minute or two after boot to reach the REST API
    for waited in $(seq 0 5 120); do
        status=$(curl -s -m 5 -X POST -H 'Content-Type: application/json' \
                 -d '{"target":{"all":true},"status":true}' http://localhost/jaia/v1)
        echo "$status" | grep -q "\"hub_id\":${id}" && break
        sleep 5
    done
    if echo "$status" | grep -q "\"hub_id\":${id}"; then ok "hub ${id} is in its own REST API status (JCC will show it)$([ "$waited" -gt 0 ] && echo ", after ${waited} s")"
    else fail "hub ${id} is not in its own REST API status after ${waited} s (up $(cut -d. -f1 /proc/uptime) s): JCC will not show it"; fi
fi

if [ "$PAIRED" = true ]; then
    profile=$(ls /etc/wireguard 2>/dev/null | grep -o 'wg_jaia_ch[0-9]*' | head -1)
    profile=${profile:-$(sudo -n ls /etc/wireguard 2>/dev/null | grep -o 'wg_jaia_ch[0-9]*' | head -1)}
    if [ -z "$profile" ] || ! systemctl is-active --quiet "wg-quick@${profile}"; then
        fail "the CloudHub VPN tunnel is not up (not paired, or start-at-boot was answered no)"
    else
        handshake=$(sudo -n wg show "$profile" latest-handshakes 2>/dev/null | awk '{print $2; exit}')
        age=$(( $(date +%s) - ${handshake:-0} ))
        if [ "${handshake:-0}" != 0 ] && [ "$age" -lt 300 ]; then ok "${profile} handshook ${age} s ago with $(cat /etc/jaiabot/cloudhub_host 2>/dev/null)"
        else fail "${profile} is up but has not handshaken in 5 min: wrong CloudHub address, or the CloudHub was replaced (Pair Fleet to CloudHub again)"; fi
    fi
    if [ "$type" = hub ]; then
        ss -lun 2>/dev/null | grep -q ':32000 ' && ok "hub-to-hub link bound (UDP 32000)" || fail "UDP 32000 not bound: other hubs will not see this one"
    fi
fi
exit $bad
EOF
