#!/usr/bin/env python3

"""A teardown that could not ask AWS must not say there was nothing to delete.

With an expired 'aws login' every call in delete_vpc.sh failed, and it reported "No
instances found." and "No VPC found." for a fleet whose CloudHub, VirtualFleet and
VPC were all still running. Runs the script from the source tree against a stub aws.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = SOURCE_DIR / "rootfs" / "cloud" / "aws" / "delete_vpc.sh"

EXPIRED = "aws: [ERROR]: Your session has expired. Please reauthenticate using 'aws login'."

# $JAIA_TEST_FAIL names the calls ("sts", "describe-instances", ...) that fail;
# $JAIA_TEST_FLEET=present gives the fleet an instance, an Elastic IP and a VPC
STUB = r"""#!/bin/bash
echo "aws $*" >> "$JAIA_TEST_CALLS"
call=$1; [ "$1" = ec2 ] || [ "$1" = iam ] && call=$2
for f in ${JAIA_TEST_FAIL:-}; do
    if [ "$f" = "$call" ] || [ "$f" = all ]; then echo "%(expired)s" >&2; exit 254; fi
done
present() { [ "${JAIA_TEST_FLEET:-}" = present ]; }
case "$call" in
    sts) echo "arn:aws:iam::123456789012:user/tech" ;;
    describe-instances) present && echo "i-0123456789abcdef0" || echo "" ;;
    describe-addresses) present && echo "eipalloc-0123" || echo "" ;;
    describe-vpcs) present && echo "vpc-0123" || echo "" ;;
    describe-internet-gateways|describe-subnets|describe-route-tables|describe-security-groups) echo "" ;;
    get-instance-profile|get-role) echo "An error occurred (NoSuchEntity) when calling the operation" >&2; exit 254 ;;
    *) exit 0 ;;
esac
""" % {"expired": EXPIRED}


class DeleteVpcTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.calls = os.path.join(self.dir, "calls")
        fake_bin = os.path.join(self.dir, "bin")
        os.makedirs(fake_bin)
        with open(os.path.join(fake_bin, "aws"), "w") as f:
            f.write(STUB)
        os.chmod(os.path.join(fake_bin, "aws"), 0o755)
        self.env = dict(os.environ, PATH=fake_bin + os.pathsep + os.environ["PATH"],
                        AWS_DEFAULT_REGION="ca-central-1", JAIA_TEST_CALLS=self.calls)

    def run_delete(self, **env):
        self.env.update(env)
        return subprocess.run(["bash", str(SCRIPT), "--yes", "8"], capture_output=True, text=True,
                              env=self.env, cwd=SCRIPT.parent)

    def recorded(self):
        if not os.path.exists(self.calls):
            return ""
        with open(self.calls) as f:
            return f.read()

    def test_an_expired_login_stops_before_anything_and_says_nothing_was_deleted(self):
        result = self.run_delete(JAIA_TEST_FAIL="all")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Nothing was deleted", result.stderr)
        self.assertIn("session has expired", result.stderr)
        self.assertNotIn("No instances found", result.stdout)
        self.assertNotIn("No VPC found", result.stdout)
        self.assertNotIn("describe-", self.recorded())

    def test_a_failed_lookup_is_a_failure_not_an_absence(self):
        result = self.run_delete(JAIA_TEST_FAIL="describe-instances describe-vpcs")
        self.assertNotEqual(result.returncode, 0)
        out = result.stdout + result.stderr
        self.assertIn("Could not look up instances", out)
        self.assertIn("Could not look up VPCs", out)
        self.assertNotIn("No instances found", out)
        self.assertNotIn("No VPC found", out)
        self.assertIn("did not complete", result.stderr)
        self.assertIn("look up instances", result.stderr)

    def test_a_fleet_that_is_gone_is_a_clean_teardown(self):
        result = self.run_delete()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("No instances found", result.stdout)
        self.assertIn("No VPC found", result.stdout)
        self.assertIn("Cleanup completed", result.stdout)

    def test_a_fleet_that_is_there_is_deleted(self):
        result = self.run_delete(JAIA_TEST_FLEET="present")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        calls = self.recorded()
        self.assertIn("release-address --allocation-id eipalloc-0123", calls)
        self.assertIn("terminate-instances", calls)
        self.assertIn("delete-vpc --vpc-id vpc-0123", calls)

    def test_a_lookup_that_fails_inside_the_vpc_leaves_the_teardown_incomplete(self):
        result = self.run_delete(JAIA_TEST_FLEET="present", JAIA_TEST_FAIL="describe-subnets")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Could not look up subnets of vpc-0123", result.stdout)
        self.assertIn("did not complete", result.stderr)


if __name__ == "__main__":
    unittest.main()
