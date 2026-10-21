#!/usr/bin/env python3
"""jaia-dns-lookup.py asks the zone's own name servers, following a CNAME into
another zone, so a stale answer in a resolver on the way does not reach Caddy."""

import importlib.util
import pathlib
import sys
import types
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-dns-lookup.py"

# The zones a fake resolver knows: (name, type) -> records, with the name server of
# each zone answering only its own names
ZONES = {
    "example.org.": {"ns": ["ns.example.org."], "ns_ip": "192.0.2.53", "records": {
        ("fleet9.example.org.", "A"): ["198.51.100.9"],
        ("fleet9.example.org.", "AAAA"): ["2001:db8::9"],
        ("run.fleet9.example.org.", "CNAME"): ["fleet9.example.org."],
        ("docs.example.org.", "CNAME"): ["pages.example.net."],
    }},
    "example.net.": {"ns": ["ns.example.net."], "ns_ip": "192.0.2.54", "records": {
        ("pages.example.net.", "A"): ["203.0.113.80"],
    }},
}


def zone_of(name):
    for zone in ZONES:
        if name == zone or name.endswith("." + zone):
            return zone
    return None


class FakeRdata:
    def __init__(self, value):
        self.address = value
        self.target = types.SimpleNamespace(to_text=lambda: value)


class FakeRRset(list):
    def __init__(self, rdtype, values):
        super().__init__(FakeRdata(v) for v in values)
        self.rdtype = rdtype


class FakeAnswer:
    def __init__(self, rrset, answer_section):
        self.rrset = rrset
        self.response = types.SimpleNamespace(answer=answer_section)


class NoAnswer(Exception):
    pass


class FakeResolver:
    """configure=True: a caching resolver that may be stale (its A answers come from
    STALE when set). configure=False: queries go to the zone's own server."""
    STALE = {}

    def __init__(self, configure=True):
        self.configure = configure
        self.nameservers = []
        self.lifetime = None

    def resolve(self, name, rtype, raise_on_no_answer=True):
        name = name if name.endswith(".") else name + "."
        if self.configure:
            if rtype == "NS":
                if name in ZONES:
                    return FakeRRset("NS", ZONES[name]["ns"])
                raise NoAnswer(name)
            if rtype == "A":
                for zone in ZONES.values():
                    if name in zone["ns"]:
                        return FakeRRset("A", [zone["ns_ip"]])
                if (name, "A") in self.STALE:
                    return FakeRRset("A", self.STALE[(name, "A")])
            raise NoAnswer(name)
        zone = next((z for z in ZONES.values() if z["ns_ip"] in self.nameservers), None)
        if zone is None or zone_of(name) is None or ZONES[zone_of(name)] is not zone:
            raise NoAnswer("not authoritative for " + name)
        records = zone["records"]
        if (name, rtype) in records:
            rrset = FakeRRset(rtype, records[(name, rtype)])
            return FakeAnswer(rrset, [rrset])
        if (name, "CNAME") in records:
            cname = FakeRRset("CNAME", records[(name, "CNAME")])
            target = records[(name, "CNAME")][0]
            if (target, rtype) in records:
                rrset = FakeRRset(rtype, records[(target, rtype)])
                return FakeAnswer(rrset, [cname, rrset])
            return FakeAnswer(None, [cname])
        if raise_on_no_answer:
            raise NoAnswer(name)
        return FakeAnswer(None, [])


def load_script():
    fake_dns = types.ModuleType("dns")
    fake_dns.exception = types.SimpleNamespace(DNSException=NoAnswer)
    fake_dns.rdatatype = types.SimpleNamespace(CNAME="CNAME")
    fake_dns.resolver = types.SimpleNamespace(Resolver=FakeResolver)
    for name in ("dns", "dns.exception", "dns.rdatatype", "dns.resolver"):
        sys.modules[name] = getattr(fake_dns, name.split(".")[1]) if "." in name else fake_dns
    spec = importlib.util.spec_from_file_location("jaia_dns_lookup", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DnsLookupTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lookup = load_script()

    def setUp(self):
        FakeResolver.STALE = {}

    def test_answers_come_from_the_zone_not_the_local_resolver(self):
        FakeResolver.STALE = {("fleet9.example.org.", "A"): ["192.0.2.99"]}
        self.assertEqual(self.lookup.lookup("fleet9.example.org", "A"), ["198.51.100.9"])
        self.assertEqual(self.lookup.lookup("fleet9.example.org", "AAAA"), ["2001:db8::9"])

    def test_cname_within_the_zone(self):
        self.assertEqual(self.lookup.lookup("run.fleet9.example.org", "A"), ["198.51.100.9"])

    def test_cname_into_another_zone_is_followed_at_that_zone(self):
        self.assertEqual(self.lookup.lookup("docs.example.org", "A"), ["203.0.113.80"])

    def test_missing_record_and_unknown_zone_give_nothing(self):
        self.assertEqual(self.lookup.lookup("none.fleet9.example.org", "A"), [])
        self.assertEqual(self.lookup.lookup("docs.example.org", "AAAA"), [])
        self.assertEqual(self.lookup.lookup("fleet9.example.com", "A"), [])

    def test_usage(self):
        self.assertEqual(self.lookup.main(["x"]), 2)
        self.assertEqual(self.lookup.main(["x", "fleet9.example.org", "MX"]), 2)


if __name__ == "__main__":
    unittest.main()
