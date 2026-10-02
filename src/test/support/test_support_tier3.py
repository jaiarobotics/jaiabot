#!/usr/bin/env python3

"""A support grant is one record; the peer and the keys are what it implies.

Tier 3 goes wrong quietly when the two halves drift - a WireGuard peer left
behind reaches a fleet nobody granted it, and a key left behind is a login
waiting for the next tunnel. So these tests drive the real script against stub
peers, stub nodes and a stub directory, and check both halves after every
grant, revocation, expiry and withdrawal of the customer's approval.
"""

import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "src" / "sh" / "system" / "jaia-support-access.py"

FLEET = 7
CLOUDHUB_ADDR = "fd0f:77ac:4fdf:7::1:1e"
NODES = ["fd0f:77ac:4fdf:7::2:1", "fd0f:77ac:4fdf:7::2:2", "fd0f:77ac:4fdf:7::1:1"]
WG_KEY = "CkA5z9dOczQFFX+l3jKFc+SKrFys0ePoHFnErg+Y8Ec="
SSH_KEY = "sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2g= jaia@root_yubikey1"
DAY = 86400


def stub(path, body):
    with open(path, "w") as f:
        f.write("#!/bin/sh\n" + body)
    os.chmod(path, 0o755)


class Tier3Test(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)

        self.state = os.path.join(self.dir, "state")
        self.tier3 = os.path.join(self.state, "tier3")
        self.peers = os.path.join(self.dir, "peers")
        os.makedirs(self.peers)
        self.pushes = os.path.join(self.dir, "pushes")
        self.unreachable = os.path.join(self.dir, "unreachable")
        open(self.unreachable, "w").close()

        self.inventory = os.path.join(self.dir, "inventory.yml")
        with open(self.inventory, "w") as f:
            for address in NODES + [CLOUDHUB_ADDR]:
                f.write("    node:\n      ansible_user: jaia\n"
                        "      ansible_host: {}\n".format(address))

        self.bin = os.path.join(self.dir, "bin")
        os.makedirs(self.bin)
        # sudo and 'sudo -u <user>' both just run what follows
        stub(os.path.join(self.bin, "sudo"),
             'if [ "$1" = "-u" ]; then shift 2; fi\nexec "$@"\n')
        stub(os.path.join(self.bin, "jaia_ip"),
             'type=""; id=""\n'
             'while [ $# -gt 0 ]; do\n'
             '  case "$1" in --node_type) type=$2; shift 2;; --node_id) id=$2; shift 2;;'
             ' *) shift;; esac\n'
             'done\n'
             'case "$type" in\n'
             '  desktop) echo "fd0f:77ac:4fdf:7::3:$id";;\n'
             '  hub) [ "$id" = 30 ] && echo "{}" || echo "fd0f:77ac:4fdf:7::1:$id";;\n'
             '  *) echo "fd0f:77ac:4fdf:7::2:$id";;\n'
             'esac\n'.format(CLOUDHUB_ADDR))
        stub(os.path.join(self.bin, "jaia_bounds"), "echo 30\n")
        stub(os.path.join(self.bin, "peers.sh"),
             'action=$1; iface=$2\n'
             'case "$action" in\n'
             '  list) ls "{dir}" 2>/dev/null | sed "s/\\.conf$//";;\n'
             '  add) [ ! -e "{dir}/$3.conf" ] || exit 1; echo "$4 $5" > "{dir}/$3.conf";;\n'
             '  remove) rm -f "{dir}/$3.conf";;\n'
             'esac\n'.format(dir=self.peers))
        # The node side: refuses for an address listed as unreachable, and
        # otherwise records what it was asked to run
        stub(os.path.join(self.bin, "ssh"),
             'while [ $# -gt 1 ]; do\n'
             '  case "$1" in -o) shift 2;; *) break;; esac\n'
             'done\n'
             'host=${{1#jaia@}}; shift\n'
             'grep -qx "$host" "{missed}" && exit 255\n'
             'echo "$host $*" >> "{log}"\n'.format(missed=self.unreachable, log=self.pushes))

    def run_script(self, *args, expect=0):
        environment = dict(os.environ,
                           PATH=self.bin + os.pathsep + os.environ["PATH"],
                           JAIA_FLEET_ID=str(FLEET),
                           JAIA_SUPPORT_STATE_DIR=self.state,
                           JAIA_INVENTORY=self.inventory,
                           JAIA_VPN_PEERS=os.path.join(self.bin, "peers.sh"))
        done = subprocess.run(["python3", str(SCRIPT)] + list(args), env=environment,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.assertEqual(expect, done.returncode, done.stderr)
        return done

    ## State the customer holds

    def approve(self, days=14):
        os.makedirs(self.state, exist_ok=True)
        with open(os.path.join(self.state, "grant.json"), "w") as f:
            json.dump({"expires_at": int(time.time()) + days * DAY}, f)

    def withdraw(self):
        os.unlink(os.path.join(self.state, "grant.json"))

    def grant(self, days=7, desktop=9):
        return self.run_script("grant", "--desktop", str(desktop), "--wg-key", WG_KEY,
                               "--ssh-key", SSH_KEY, "--days", str(days))

    ## What the fleet ended up with

    def peer_names(self):
        return sorted(p[:-5] for p in os.listdir(self.peers) if p.endswith(".conf"))

    def pushed(self):
        try:
            with open(self.pushes) as f:
                return [line.strip() for line in f if line.strip()]
        except OSError:
            return []

    def hosts_given_the_key(self):
        return sorted({line.split()[0] for line in self.pushed() if "tee -a" in line})

    def hosts_told_to_drop_it(self):
        return sorted({line.split()[0] for line in self.pushed() if "tee -a" not in line})

    def record(self, desktop=9):
        with open(os.path.join(self.tier3, "support{}.json".format(desktop))) as f:
            return json.load(f)

    def audit(self):
        with open(os.path.join(self.state, "audit.log")) as f:
            return [json.loads(line) for line in f if line.strip()]

    ## Tests

    def test_nothing_is_granted_without_the_customer(self):
        self.run_script("grant", "--desktop", "9", "--wg-key", WG_KEY, "--ssh-key", SSH_KEY,
                        expect=1)
        self.assertEqual([], self.peer_names())
        self.assertEqual([], self.pushed())

    def test_a_grant_adds_the_peer_and_the_key_together(self):
        self.approve()
        self.grant(days=3)
        self.assertEqual(["support9"], self.peer_names())
        self.assertEqual(sorted(NODES), self.hosts_given_the_key())
        # the CloudHub is reached with the group membership, not with this
        self.assertNotIn(CLOUDHUB_ADDR, self.hosts_given_the_key())

    def test_the_key_carries_an_expiry(self):
        self.approve()
        self.grant(days=3)
        ends = time.strftime("%Y%m%d", time.localtime(time.time() + 3 * DAY))
        self.assertTrue(all('expiry-time="{}"'.format(ends) in line
                            for line in self.pushed()), self.pushed())

    def test_revoking_takes_both_halves_back(self):
        self.approve()
        self.grant()
        open(self.pushes, "w").close()

        self.run_script("revoke", "--desktop", "9")
        self.assertEqual([], self.peer_names())
        self.assertEqual(sorted(NODES), self.hosts_told_to_drop_it())
        self.assertFalse(os.path.exists(os.path.join(self.tier3, "support9.json")))

    def test_more_than_two_weeks_is_refused(self):
        self.approve()
        self.run_script("grant", "--desktop", "9", "--wg-key", WG_KEY, "--ssh-key", SSH_KEY,
                        "--days", "30", expect=1)
        self.assertEqual([], self.peer_names())

    def test_an_expiry_edited_past_the_cap_is_not_honoured(self):
        """The record is on a machine Jaia has a shell on, so the cap cannot
        rest on what the record says."""
        self.approve(days=60)
        self.grant(days=7)

        forged = self.record()
        forged["granted_at"] = int(time.time()) - 20 * DAY
        forged["expires_at"] = int(time.time()) + 300 * DAY
        with open(os.path.join(self.tier3, "support9.json"), "w") as f:
            json.dump(forged, f)

        open(self.pushes, "w").close()
        self.run_script("reconcile")
        self.assertEqual([], self.peer_names())
        self.assertEqual(sorted(NODES), self.hosts_told_to_drop_it())

    def test_tier_three_ends_when_the_customer_ends_tier_two(self):
        self.approve(days=14)
        self.grant(days=14)
        self.withdraw()

        open(self.pushes, "w").close()
        self.run_script("reconcile")
        self.assertEqual([], self.peer_names())
        self.assertEqual(sorted(NODES), self.hosts_told_to_drop_it())
        self.assertEqual("customer ended support access", self.audit()[-1]["why"])

    def test_tier_three_cannot_outlast_what_the_customer_approved(self):
        self.approve(days=2)
        self.grant(days=14)
        ends = time.strftime("%Y%m%d", time.localtime(time.time() + 2 * DAY))
        self.assertTrue(all('expiry-time="{}"'.format(ends) in line
                            for line in self.pushed()), self.pushed())

    def test_a_peer_with_no_grant_behind_it_is_removed(self):
        self.approve()
        with open(os.path.join(self.peers, "support4.conf"), "w") as f:
            f.write("[Peer]\n")
        self.run_script("reconcile")
        self.assertEqual([], self.peer_names())

    def test_a_node_that_is_off_does_not_stop_the_others(self):
        self.approve()
        with open(self.unreachable, "w") as f:
            f.write(NODES[0] + "\n")

        self.grant()
        self.assertEqual(["support9"], self.peer_names())
        self.assertEqual(sorted(NODES[1:]), self.hosts_given_the_key())

        # and it is caught up the next time the timer runs
        open(self.unreachable, "w").close()
        open(self.pushes, "w").close()
        self.run_script("reconcile")
        self.assertEqual(sorted(NODES), self.hosts_given_the_key())

    def test_every_grant_and_every_ending_is_written_down(self):
        self.approve()
        self.grant(days=5)
        self.run_script("revoke", "--desktop", "9")

        entries = self.audit()
        self.assertEqual(["tier3_grant", "tier3_end"], [e["action"] for e in entries])
        self.assertEqual(9, entries[0]["desktop"])
        self.assertEqual("revoked", entries[1]["why"])


if __name__ == "__main__":
    unittest.main()
