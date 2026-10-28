#!/bin/bash

# Succeeds once every name given resolves to this CloudHub's public addresses. Caddy
# is held until then: Let's Encrypt backs off for up to an hour after each failed
# validation, so asking before the DNS records exist delays the certificates long after.

set -u -o pipefail

imds=${JAIA_IMDS:-http://169.254.169.254}

token=$(curl -fsS -m 2 -X PUT "$imds/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60") || {
    echo "No answer from the instance metadata service" >&2
    exit 1
}
meta() {
    curl -fsS -m 2 -H "X-aws-ec2-metadata-token: $token" "$imds/latest/meta-data/$1"
}

ipv4=$(meta public-ipv4) || {
    echo "This instance has no public IPv4 address" >&2
    exit 1
}
ipv6s=$(meta "network/interfaces/macs/$(meta mac)/ipv6s") || ipv6s=""

# Asked at the zone's own name servers: a resolver on the way (the VPC's, this
# host's) can hold an old answer for the record's whole TTL
for name in "$@"; do
    found=$(jaia-dns-lookup.py "$name" A | sort -u)
    if ! grep -qxF "$ipv4" <<< "$found"; then
        echo "Waiting for $name to resolve to $ipv4 (now: $(echo ${found:-nothing}))"
        exit 1
    fi
    # Let's Encrypt validates over IPv6 when there is an AAAA record, so a stale one fails it too
    for addr in $(jaia-dns-lookup.py "$name" AAAA | sort -u); do
        if ! grep -qxF "$addr" <<< "$ipv6s"; then
            echo "Waiting for $name to resolve to this CloudHub's IPv6 address (now: $addr)"
            exit 1
        fi
    done
done

echo "$* resolve to this CloudHub"
