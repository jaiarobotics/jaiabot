#!/usr/bin/env python3

"""A support grant is one record; everything else is what it implies.

Access goes wrong quietly when those drift apart - a WireGuard peer left behind
reaches a fleet nobody granted it, a key left behind is a login waiting for the
next tunnel, and group membership left behind is the standing access this whole
design exists to end. So these tests drive the real script against a stand-in
CloudHub and check every part after each grant, revocation, expiry and
withdrawal of the customer's approval.
"""

import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest

from support_stubs import CLOUDHUB_ADDR, FLEET, NODES, CloudHub, FakeLldap

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-access.py"

WG_KEY = "CkA5z9dOczQFFX+l3jKFc+SKrFys0ePoHFnErg+Y8Ec="
SSH_KEY = "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2g= jaia@root_yubikey1"
DAY = 86400


class Tier3Test(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.hub = CloudHub(self.dir)
        self.addCleanup(self.hub.close)

    def run_script(self, *args, expect=0):
        done = subprocess.run(["python3", str(SCRIPT)] + list(args), env=self.hub.environment(),
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.assertEqual(expect, done.returncode, done.stderr)
        return done

    def approve(self, days=14):
        self.run_script("approve", "--fleet", str(FLEET), "--days", str(days),
                        "--reason", "Pump fault on bot 3", "--by", "operator")

    def grant(self, days=7, desktop=9):
        return self.run_script("grant", "--desktop", str(desktop), "--wg-key", WG_KEY,
                               "--ssh-key", SSH_KEY, "--days", str(days))

    def record(self, desktop=9):
        with open(os.path.join(self.hub.tier3, "support{}.json".format(desktop))) as f:
            return json.load(f)

    def tier2(self):
        with open(os.path.join(self.hub.state, "grant.json")) as f:
            return json.load(f)

    def write_tier2(self, grant):
        with open(os.path.join(self.hub.state, "grant.json"), "w") as f:
            json.dump(grant, f)

    def write_record(self, record, desktop=9):
        with open(os.path.join(self.hub.tier3, "support{}.json".format(desktop)), "w") as f:
            json.dump(record, f)

    ## Tier 2

    def test_approving_puts_the_support_account_in_the_group(self):
        self.approve(days=3)
        self.assertEqual({"jaia_support"}, FakeLldap.members)

    def test_revoking_takes_it_back_out(self):
        self.approve()
        self.run_script("revoke", "--by", "operator")
        self.assertEqual(set(), FakeLldap.members)

    def test_an_expired_approval_is_taken_back_without_anyone_acting(self):
        self.approve(days=1)
        forged = self.tier2()
        forged["approved_at"] -= 2 * DAY
        forged["expires_at"] -= 2 * DAY
        self.write_tier2(forged)

        self.run_script("reconcile")
        self.assertEqual(set(), FakeLldap.members)
        self.assertEqual("expired", self.hub.audit()[-1]["why"])

    def test_an_approval_edited_past_the_cap_is_not_honoured(self):
        """grant.json sits on a machine Jaia has a shell on once tier 2 is live,
        so the cap cannot rest on what it says."""
        self.approve(days=14)
        forged = self.tier2()
        forged["expires_at"] = int(time.time()) + 300 * DAY
        self.write_tier2(forged)

        self.run_script("reconcile")
        self.assertEqual({"jaia_support"}, FakeLldap.members)

        forged["approved_at"] -= 20 * DAY
        self.write_tier2(forged)
        self.run_script("reconcile")
        self.assertEqual(set(), FakeLldap.members)

    ## Tier 3

    def test_nothing_reaches_the_fleet_without_the_customer(self):
        self.run_script("grant", "--desktop", "9", "--wg-key", WG_KEY, "--ssh-key", SSH_KEY,
                        expect=1)
        self.assertEqual([], self.hub.peer_names())
        self.assertEqual([], self.hub.pushed())

    def test_a_grant_adds_the_peer_and_the_key_together(self):
        self.approve()
        self.grant(days=3)
        self.assertEqual(["support9"], self.hub.peer_names())
        self.assertEqual(sorted(NODES), self.hub.hosts_given_the_key())
        # the CloudHub is reached with the group membership, not with this
        self.assertNotIn(CLOUDHUB_ADDR, self.hub.hosts_given_the_key())

    def test_the_key_carries_an_expiry(self):
        self.approve()
        self.grant(days=3)
        ends = time.strftime("%Y%m%d", time.localtime(time.time() + 3 * DAY))
        self.assertTrue(all('expiry-time="{}"'.format(ends) in line
                            for line in self.hub.pushed()), self.hub.pushed())

    def test_ending_a_grant_takes_both_halves_back(self):
        self.approve()
        self.grant()
        self.hub.forget_pushes()

        self.run_script("end", "--desktop", "9")
        self.assertEqual([], self.hub.peer_names())
        self.assertEqual(sorted(NODES), self.hub.hosts_told_to_drop_it())
        self.assertFalse(os.path.exists(os.path.join(self.hub.tier3, "support9.json")))

    def test_more_than_two_weeks_is_refused(self):
        self.approve()
        self.run_script("grant", "--desktop", "9", "--wg-key", WG_KEY, "--ssh-key", SSH_KEY,
                        "--days", "30", expect=1)
        self.assertEqual([], self.hub.peer_names())

    def test_a_tier_three_expiry_edited_past_the_cap_is_not_honoured(self):
        self.approve(days=14)
        self.grant(days=7)

        forged = self.record()
        forged["granted_at"] = int(time.time()) - 20 * DAY
        forged["expires_at"] = int(time.time()) + 300 * DAY
        self.write_record(forged)

        self.hub.forget_pushes()
        self.run_script("reconcile")
        self.assertEqual([], self.hub.peer_names())
        self.assertEqual(sorted(NODES), self.hub.hosts_told_to_drop_it())

    def test_tier_three_ends_when_the_customer_ends_tier_two(self):
        self.approve(days=14)
        self.grant(days=14)
        self.hub.forget_pushes()

        self.run_script("revoke", "--by", "operator")
        self.assertEqual([], self.hub.peer_names())
        self.assertEqual(sorted(NODES), self.hub.hosts_told_to_drop_it())
        self.assertEqual(set(), FakeLldap.members)

    def test_tier_three_cannot_outlast_what_the_customer_approved(self):
        self.approve(days=2)
        self.grant(days=14)
        ends = time.strftime("%Y%m%d", time.localtime(time.time() + 2 * DAY))
        self.assertTrue(all('expiry-time="{}"'.format(ends) in line
                            for line in self.hub.pushed()), self.hub.pushed())

    def test_a_peer_with_no_grant_behind_it_is_removed(self):
        self.approve()
        with open(os.path.join(self.hub.peers, "support4.conf"), "w") as f:
            f.write("[Peer]\n")
        self.run_script("reconcile")
        self.assertEqual([], self.hub.peer_names())

    def test_a_node_that_is_off_does_not_stop_the_others(self):
        self.approve()
        self.hub.set_unreachable([NODES[0]])

        self.grant()
        self.assertEqual(["support9"], self.hub.peer_names())
        self.assertEqual(sorted(NODES[1:]), self.hub.hosts_given_the_key())

        # and it is caught up the next time the timer runs
        self.hub.set_unreachable([])
        self.hub.forget_pushes()
        self.run_script("reconcile")
        self.assertEqual(sorted(NODES), self.hub.hosts_given_the_key())

    def test_reconciling_records_when_it_last_ran(self):
        self.approve()
        self.run_script("reconcile")
        with open(os.path.join(self.hub.state, "last-reconcile")) as f:
            self.assertAlmostEqual(time.time(), int(f.read().strip()), delta=10)

    def test_every_grant_and_every_ending_is_written_down(self):
        self.approve()
        self.grant(days=5)
        self.run_script("end", "--desktop", "9")

        actions = [entry["action"] for entry in self.hub.audit()]
        self.assertEqual(["tier2_grant", "tier3_grant", "tier3_end"], actions)
        self.assertEqual("ended by Jaia", self.hub.audit()[-1]["why"])


if __name__ == "__main__":
    unittest.main()
