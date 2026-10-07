#!/usr/bin/env python3

"""What the grant actually does: open one port to one address, and shut it again.

These drive the real jaia-support-access.py against a stand-in security group and
ufw. The cases worth having are the ones where the firewall and the record can
disagree - an expiry nobody is present for, a record edited on the CloudHub, a
rule left behind by a run that died halfway - because every one of them fails
open if reconciling is not doing its job.
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from support_stubs import FLEET, CloudHub

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
ACCESS = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-access.py"

SOURCE = "198.51.100.7"
CIDR = "198.51.100.7/32"


class FirewallTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.hub = CloudHub(self.dir)
        self.addCleanup(self.hub.close)

    def access(self, *args, expect=0):
        done = subprocess.run([sys.executable, str(ACCESS)] + list(args),
                              env=self.hub.environment(), stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True)
        self.assertEqual(expect, done.returncode, done.stderr)
        return done.stdout.strip()

    def approve(self, days=7, source=SOURCE, scopes="shell"):
        return self.access("approve", "--fleet", str(FLEET), "--days", str(days),
                           "--source", source, "--reason", "Pump fault on bot 3",
                           "--scopes", scopes, "--by", "operator")

    def grant_file(self):
        return os.path.join(self.hub.state, "grant.json")

    def rewrite_grant(self, **changes):
        with open(self.grant_file()) as f:
            granted = json.load(f)
        granted.update(changes)
        with open(self.grant_file(), "w") as f:
            json.dump(granted, f)

    ## Tests

    def test_approving_opens_the_port_to_that_address_alone(self):
        self.approve()
        self.assertEqual([CIDR], self.hub.open_to())

    def test_a_bare_address_opens_one_host(self):
        self.approve(source="10.1.2.3")
        self.assertEqual(["10.1.2.3/32"], self.hub.open_to())

    def test_a_prefix_with_host_bits_set_is_refused(self):
        """198.51.100.7/24 reads as one address. Rounding it down would open 256,
        and the customer would have approved a page that said the one."""
        self.access("approve", "--fleet", str(FLEET), "--days", "7",
                    "--source", "198.51.100.7/24", expect=1)
        self.assertEqual([], self.hub.open_to())

    def test_an_ipv6_address_is_opened_as_ipv6(self):
        self.approve(source="2001:db8::1")
        self.assertEqual(["2001:db8::1/128"], self.hub.open_to())
        self.assertTrue(any("Ipv6Ranges" in call for call in self.hub.aws_calls()))

    def test_a_cidr_is_kept_as_given(self):
        self.approve(source="198.51.100.0/24")
        self.assertEqual(["198.51.100.0/24"], self.hub.open_to())

    def test_revoking_closes_the_port(self):
        self.approve()
        self.access("revoke", "--by", "operator")
        self.assertEqual([], self.hub.open_to())
        self.assertFalse(os.path.exists(self.grant_file()))

    def test_the_port_shuts_when_the_grant_expires(self):
        """Nobody is present for this, which is the point of it."""
        self.approve(days=1)
        self.rewrite_grant(expires_at=int(time.time()) - 1)
        self.access("reconcile")
        self.assertEqual([], self.hub.open_to())
        self.assertFalse(os.path.exists(self.grant_file()))
        self.assertIn("expired", [e.get("why") for e in self.hub.audit()])

    def test_an_expiry_past_the_cap_is_not_honoured(self):
        """The record is on a machine Jaia has a shell on once a grant is live, so
        the cap is applied on every run rather than trusted from the file."""
        self.approve(days=14)
        self.rewrite_grant(expires_at=int(time.time()) + 365 * 86400,
                           approved_at=int(time.time()) - 15 * 86400)
        self.access("reconcile")
        self.assertEqual([], self.hub.open_to())

    def test_moving_the_grant_to_another_address_closes_the_first(self):
        self.approve()
        self.approve(source="203.0.113.9")
        self.assertEqual(["203.0.113.9/32"], self.hub.open_to())

    def test_reconciling_twice_leaves_one_rule(self):
        """The second run finds the rule already there, which the security group
        reports as an error; converging means treating that as success."""
        self.approve()
        self.access("reconcile")
        self.assertEqual([CIDR], self.hub.open_to())

    def test_closing_a_rule_that_is_already_gone_is_not_an_error(self):
        """A revoke that raced a rule removed by hand must still finish, or the
        record and the firewall stay apart for good."""
        self.approve()
        with open(self.hub.security_group, "w") as f:
            json.dump([], f)
        self.access("revoke", "--by", "operator")
        self.assertEqual([], self.hub.open_to())

    def test_a_rule_with_no_grant_behind_it_is_closed(self):
        """It admits somebody nobody granted, so reconciling takes it away rather
        than leaving it for whoever notices."""
        self.approve()
        os.unlink(self.grant_file())
        self.access("reconcile")
        self.assertEqual([], self.hub.open_to())

    def test_ufw_is_set_to_match(self):
        """The security group is the gate that matters, but it only exists on EC2."""
        self.approve()
        self.assertTrue(any(call.startswith("allow from {}".format(CIDR))
                            for call in self.hub.ufw_calls()))
        self.access("revoke", "--by", "operator")
        self.assertTrue(any("delete allow from {}".format(CIDR) in call
                            for call in self.hub.ufw_calls()))

    def test_ending_access_disconnects_sessions_from_that_address(self):
        """Closing the port admits nobody new, but a session already open would
        otherwise run on for as long as the engineer kept it."""
        self.approve()
        self.assertEqual([], self.hub.ss_calls())
        self.access("revoke", "--by", "operator")
        self.assertEqual(["-K state established ( sport = :22 ) dst {}".format(CIDR)],
                         self.hub.ss_calls())

    def test_expiry_disconnects_sessions_too(self):
        self.approve(days=1)
        self.rewrite_grant(expires_at=int(time.time()) - 1)
        self.access("reconcile")
        self.assertEqual(["-K state established ( sport = :22 ) dst {}".format(CIDR)],
                         self.hub.ss_calls())

    def test_status_says_what_is_open(self):
        self.approve()
        state = json.loads(self.access("status"))
        self.assertEqual(CIDR, state["open"]["cidr"])
        self.assertEqual(CIDR, state["grant"]["source"])
        self.assertEqual(FLEET, state["fleet"])

    def test_a_grant_longer_than_the_cap_is_refused_outright(self):
        self.access("approve", "--fleet", str(FLEET), "--days", "30",
                    "--source", SOURCE, expect=1)
        self.assertEqual([], self.hub.open_to())

    def test_an_address_that_is_not_an_address_is_refused(self):
        self.access("approve", "--fleet", str(FLEET), "--days", "7",
                    "--source", "the office", expect=1)
        self.assertEqual([], self.hub.open_to())

    ## Web access, which is the directory rather than the firewall

    WEB_GROUPS = ["jcu_developer", "jdv", "rest_api_read", "run"]

    def test_a_shell_grant_opens_no_web_access(self):
        """The two are separate on purpose, so asking for one must not quietly
        deliver the other."""
        self.approve(scopes="shell")
        self.assertEqual([], self.hub.web_groups())

    def test_a_web_grant_opens_no_port(self):
        self.approve(scopes="web")
        self.assertEqual([], self.hub.open_to())
        self.assertEqual(self.WEB_GROUPS, self.hub.web_groups())

    def test_both_can_be_granted_together(self):
        self.approve(scopes="shell,web")
        self.assertEqual([CIDR], self.hub.open_to())
        self.assertEqual(self.WEB_GROUPS, self.hub.web_groups())

    def test_revoking_takes_the_web_groups_away(self):
        self.approve(scopes="web")
        self.access("revoke", "--by", "operator")
        self.assertEqual([], self.hub.web_groups())

    def test_web_access_ends_when_the_grant_expires(self):
        """The half nobody is present for, as with the port."""
        self.approve(days=1, scopes="shell,web")
        self.rewrite_grant(expires_at=int(time.time()) - 1)
        self.access("reconcile")
        self.assertEqual([], self.hub.web_groups())
        self.assertEqual([], self.hub.open_to())

    def test_membership_with_no_grant_behind_it_is_withdrawn(self):
        self.approve(scopes="web")
        os.unlink(self.grant_file())
        self.access("reconcile")
        self.assertEqual([], self.hub.web_groups())

    def test_a_grant_the_customer_narrowed_to_the_shell_withdraws_the_web_half(self):
        """Re-approving with less is how a customer takes one half back."""
        self.approve(scopes="shell,web")
        self.approve(scopes="shell")
        self.assertEqual([CIDR], self.hub.open_to())
        self.assertEqual([], self.hub.web_groups())

    def test_a_membership_the_customer_added_themselves_is_left_alone(self):
        """Only the groups this grant is about: lldap_admin is theirs to decide."""
        self.hub.lldap.membership["jaia_support"] = ["lldap_admin"]
        self.approve(scopes="web")
        self.access("revoke", "--by", "operator")
        self.assertEqual(["lldap_admin"], self.hub.web_groups())

    def test_reconciling_with_nothing_to_change_does_not_touch_the_directory(self):
        """The timer runs every few minutes forever; one that calls LLDAP each time
        is one that reports failure whenever LLDAP is down, having had nothing to do."""
        self.approve(scopes="shell")
        before = len(self.hub.lldap_calls())
        self.access("reconcile")
        self.assertEqual(before, len(self.hub.lldap_calls()))

    def test_the_shell_still_converges_when_the_directory_is_unreachable(self):
        """LLDAP being down must not be able to hold a port open."""
        self.approve(scopes="shell,web")
        self.hub.lldap.close()
        self.rewrite_grant(expires_at=int(time.time()) - 1)
        self.access("reconcile", expect=1)
        self.assertEqual([], self.hub.open_to())

    def test_a_cloudhub_with_no_support_account_still_revokes_the_shell(self):
        """Bootstrapped before the account existed: there is no web access to take
        away, and saying so must not look like a failure."""
        self.hub.forget_the_support_account()
        self.approve(scopes="shell")
        self.access("revoke", "--by", "operator")
        self.assertEqual([], self.hub.open_to())

    def test_granting_web_on_a_cloudhub_with_no_support_account_is_refused(self):
        self.hub.forget_the_support_account()
        self.access("approve", "--fleet", str(FLEET), "--days", "7", "--source", SOURCE,
                    "--scopes", "web", expect=1)

    def test_an_unknown_scope_is_refused(self):
        self.access("approve", "--fleet", str(FLEET), "--days", "7", "--source", SOURCE,
                    "--scopes", "root", expect=1)
        self.assertEqual([], self.hub.open_to())

    def test_a_grant_written_before_scopes_existed_still_means_the_shell(self):
        """Absent is not empty: an older record asked for a shell and must keep it."""
        self.approve(scopes="shell")
        with open(self.grant_file()) as f:
            granted = json.load(f)
        del granted["scopes"]
        with open(self.grant_file(), "w") as f:
            json.dump(granted, f)
        self.access("reconcile")
        self.assertEqual([CIDR], self.hub.open_to())


if __name__ == "__main__":
    unittest.main()
