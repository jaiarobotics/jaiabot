#!/bin/bash

# Whether a CloudHub's DNS records are in place where it matters: on the zone's own
# name servers, and on the public resolvers the CloudHub's certificate authority and
# the fleet will ask. A local resolver or router can keep an old answer, so it is
# reported but does not decide the result.

usage()
{
    echo "Usage: $0 <base uri, e.g. fleet9.jaia.tech> <CloudHub IPv4> [--wait <seconds>]"
    exit 2
}

[ $# -ge 2 ] || usage
BASE_URI=$1 IPV4=$2
shift 2
WAIT=0
while (( $# > 0 )); do
    case "$1" in
        --wait) WAIT="$2"; shift 2 ;;
        *) usage ;;
    esac
done

# The zone is the nearest parent with NS records of its own
zone_servers()
{
    local name=$1 ns
    while [[ "$name" == *.* ]]; do
        ns=$(dig +short NS "$name" | grep -v '^;' | head -2)
        if [ -n "$ns" ]; then
            echo "$ns"
            return
        fi
        name=${name#*.}
    done
}

resolve()
{
    dig +short +time=3 +tries=1 "@$1" "$2" A | grep -E '^[0-9.]+$' | tail -1
}

check_once()
{
    local all_good=0 server answer name
    for server in $(zone_servers "$BASE_URI") 1.1.1.1 8.8.8.8; do
        for name in "$BASE_URI" "run.$BASE_URI" "auth.$BASE_URI"; do
            answer=$(resolve "$server" "$name")
            if [ "$answer" = "$IPV4" ]; then
                echo "ok    @$server $name -> $answer"
            else
                echo "FAIL  @$server $name -> ${answer:-nothing} (want $IPV4)"
                all_good=1
            fi
        done
    done
    answer=$(dig +short "$BASE_URI" A | tail -1)
    [ "$answer" = "$IPV4" ] || echo "note  this machine's resolver still answers ${answer:-nothing} for $BASE_URI (cached; harmless)"
    return $all_good
}

deadline=$((SECONDS + WAIT))
until check_once; do
    if (( SECONDS >= deadline )); then
        echo
        echo "DNS is not right yet. The A record for $BASE_URI must be $IPV4, and *.$BASE_URI a CNAME to $BASE_URI."
        exit 1
    fi
    echo "... checking again in 60 s"
    sleep 60
done
echo
echo "DNS is right"
