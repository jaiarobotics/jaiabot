#!/usr/bin/env python3
"""Resolve a name at its zone's own name servers, so the answer is what the
world sees rather than what a resolver on the way still has cached.

    jaia-dns-lookup.py <name> A|AAAA

Prints one address per line; nothing when the name has no such record."""

import sys

import dns.exception
import dns.rdatatype
import dns.resolver

MAX_CNAME_HOPS = 5


def zone_nameservers(resolver, name):
    """The addresses of the name servers of the closest enclosing zone."""
    labels = name.rstrip(".").split(".")
    for i in range(len(labels) - 1):
        zone = ".".join(labels[i:])
        try:
            ns_names = [r.target.to_text() for r in resolver.resolve(zone, "NS")]
        except dns.exception.DNSException:
            continue
        addresses = []
        for ns in ns_names:
            for rtype in ("A", "AAAA"):
                try:
                    addresses += [r.address for r in resolver.resolve(ns, rtype)]
                except dns.exception.DNSException:
                    pass
        if addresses:
            return addresses
    return []


def lookup(name, rtype, resolver=None, hops=0):
    resolver = resolver or dns.resolver.Resolver()
    servers = zone_nameservers(resolver, name)
    if not servers:
        return []
    authoritative = dns.resolver.Resolver(configure=False)
    authoritative.nameservers = servers
    authoritative.lifetime = 10
    try:
        answer = authoritative.resolve(name, rtype, raise_on_no_answer=False)
    except dns.exception.DNSException:
        return []
    if answer.rrset is not None:
        return [r.address for r in answer.rrset]
    # An authoritative server answers a CNAME to another zone with the CNAME alone
    for rrset in answer.response.answer:
        if rrset.rdtype == dns.rdatatype.CNAME and hops < MAX_CNAME_HOPS:
            return lookup(rrset[0].target.to_text(), rtype, resolver, hops + 1)
    return []


def main(argv):
    if len(argv) != 3 or argv[2] not in ("A", "AAAA"):
        print("Usage: jaia-dns-lookup.py <name> A|AAAA", file=sys.stderr)
        return 2
    for address in lookup(argv[1], argv[2]):
        print(address)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
