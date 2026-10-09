#!/usr/bin/env python3

"""What prep_major_upgrade changes on an existing CloudHub.

A CloudHub built by an earlier release keeps that release's IAM policy and any
port 22 rule its provisioning left open. The tool re-renders the current policy
and closes such rules, but never the support tool's own, which it opens and
closes itself while pairing or support access is granted. It also uploads the
fleet config to where the CloudHub's major upgrade looks for it.
"""

import importlib.util
import logging
import os
import pathlib
import tempfile
import textwrap
import unittest

SOURCE_DIR = pathlib.Path(__file__).resolve().parents[3]
TOOL = SOURCE_DIR / "src" / "sh" / "fleet" / "jaia-cloudhub-prep-major-upgrade.py"
TEMPLATE = SOURCE_DIR / "rootfs" / "cloud" / "aws" / "cloudhub-iam-policy.json.in"

spec = importlib.util.spec_from_file_location("jaia_cloudhub_prep_major_upgrade", TOOL)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def ssh(cidr, description=None, v6=False):
    key, cidr_key = ("Ipv6Ranges", "CidrIpv6") if v6 else ("IpRanges", "CidrIp")
    rng = {cidr_key: cidr}
    if description is not None:
        rng["Description"] = description
    return {"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, key: [rng]}


class StraySshRulesTest(unittest.TestCase):
    def test_an_old_open_rule_is_stray(self):
        group = {"IpPermissions": [ssh("0.0.0.0/0"), ssh("::/0", v6=True)]}
        self.assertEqual(tool.stray_ssh_rules(group), group["IpPermissions"])

    def test_the_support_tools_rules_are_left_alone(self):
        group = {"IpPermissions": [ssh("0.0.0.0/0", "jaia support access"),
                                   ssh("::/0", "jaia support access", v6=True)]}
        self.assertEqual(tool.stray_ssh_rules(group), [])

    def test_rules_for_one_address_are_left_alone(self):
        """A support grant's /32, or an operator's own rule"""
        group = {"IpPermissions": [ssh("203.0.113.7/32"), ssh("203.0.113.8/32", "jaia support access")]}
        self.assertEqual(tool.stray_ssh_rules(group), [])

    def test_other_ports_are_left_alone(self):
        group = {"IpPermissions": [{"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443,
                                    "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]}
        self.assertEqual(tool.stray_ssh_rules(group), [])

    def test_each_open_range_is_revoked_on_its_own(self):
        """So a rule holding the support tool's range alongside a stray one loses only the stray"""
        perm = {"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22,
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "jaia support access"},
                             {"CidrIp": "0.0.0.0/0", "Description": "provisioning"}]}
        self.assertEqual(tool.stray_ssh_rules({"IpPermissions": [perm]}),
                         [ssh("0.0.0.0/0", "provisioning")])


class RenderPolicyTest(unittest.TestCase):
    VALUES = {"REGION": "ca-central-1", "ACCOUNT_ID": "123456789012", "VPC_ID": "vpc-1",
              "CLOUDHUB_SECURITY_GROUP_ID": "sg-1", "CLOUDHUB_DATA_BUCKET": "jaia--cloudhub-data--fleet8",
              "ARN_PREFIX": "arn:aws",
              "SMTP_CREDENTIALS_PARAMETER_ARN": "arn:aws:ssm:ca-central-1:123456789012:parameter/x"}

    def test_every_placeholder_is_filled(self):
        policy = tool.render_policy(TEMPLATE, self.VALUES)
        self.assertNotIn("{{", str(policy))

    def test_the_cloudhub_may_open_its_own_security_group(self):
        """What a CloudHub built by 2.y lacks, and pairing and support access need"""
        policy = tool.render_policy(TEMPLATE, self.VALUES)
        door = next(s for s in policy["Statement"] if s["Sid"] == "SupportAccessOpensItsOwnDoor")
        self.assertEqual(door["Resource"], "arn:aws:ec2:ca-central-1:123456789012:security-group/sg-1")


class UploadFleetConfigTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.real_aws = tool.aws
        tool.aws = lambda env, *args: self.calls.append(args) or {}
        self.logger = logging.getLogger("test")

    def tearDown(self):
        tool.aws = self.real_aws

    def test_it_lands_where_the_major_upgrade_looks(self):
        uri = tool.upload_fleet_config({}, "jaia--cloudhub-data--fleet8", 8, "fleet8.cfg", False, self.logger)
        self.assertEqual(uri, "s3://jaia--cloudhub-data--fleet8/jaia/major_upgrade/fleet8.cfg")
        self.assertEqual(self.calls, [("s3", "cp", "--only-show-errors", "fleet8.cfg", uri)])

    def test_the_cli_output_is_not_mistaken_for_json(self):
        tool.aws = self.real_aws
        with tempfile.TemporaryDirectory() as bindir:
            fake = pathlib.Path(bindir) / "aws"
            fake.write_text("#!/bin/sh\n"
                            "case \" $* \" in *\" --only-show-errors \"*) ;; "
                            "*) echo 'Completed 2 Bytes/2 Bytes (3 Bytes/s) with 1 file(s) remaining' ;; esac\n")
            fake.chmod(0o755)
            env = dict(os.environ, PATH=bindir + os.pathsep + os.environ["PATH"])
            uri = tool.upload_fleet_config(env, "bucket", 8, "fleet8.cfg", False, self.logger)
        self.assertEqual(uri, "s3://bucket/jaia/major_upgrade/fleet8.cfg")

    def test_the_playbook_reads_the_same_key(self):
        playbook = (SOURCE_DIR / "config" / "ansible" / "major_upgrade" / "tasks"
                    / "hub-stage-fleet-config.yml").read_text()
        self.assertIn(tool.MAJOR_UPGRADE_PREFIX + "/fleet{{ jaiabot_embedded_fleet_id }}.cfg", playbook)

    def test_a_dry_run_uploads_nothing(self):
        with self.assertLogs("test", level="INFO") as logs:
            tool.upload_fleet_config({}, "bucket", 8, "fleet8.cfg", True, self.logger)
        self.assertEqual(self.calls, [])
        self.assertIn("would be uploaded to s3://bucket/jaia/major_upgrade/fleet8.cfg", logs.output[0])


class FleetConfigProblemTest(unittest.TestCase):
    """Against a stand-in for jaia-fleet-config.py, which needs the installed protobufs"""

    def fake_tool(self, validate_exit):
        script = pathlib.Path(self.dir.name) / "jaia-fleet-config.py"
        script.write_text(textwrap.dedent(f"""
            import sys
            assert sys.argv[1:] == ["validate", "fleet8.cfg"]
            print("missing hubs", file=sys.stderr)
            sys.exit({validate_exit})
        """))
        return str(script)

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.dir.cleanup()

    def test_a_valid_config_passes(self):
        self.assertIsNone(tool.fleet_config_problem(self.fake_tool(0), "fleet8.cfg"))

    def test_an_invalid_config_is_refused_with_the_reason(self):
        self.assertIn("missing hubs", tool.fleet_config_problem(self.fake_tool(1), "fleet8.cfg"))


if __name__ == "__main__":
    unittest.main()
