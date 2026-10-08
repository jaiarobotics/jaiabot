#!/usr/bin/env python3

"""Prepare an existing CloudHub for its major upgrade to this release.

A CloudHub has no USB key or CD to carry the fleet config into its upgrade, so
this uploads it to the CloudHub's data bucket, where the major upgrade looks for it.

A CloudHub's IAM role is written once, when it is created, so one built by an
earlier release keeps that release's policy through a major upgrade: a 2.y
CloudHub cannot open its own security group, which fleet pairing and support
access need. This re-applies the current policy to the role, and removes port 22
rules open to every address that the support tool did not make, which it would
otherwise never close. It changes nothing on the CloudHub itself.
"""

import argparse
import importlib.util
import json
import logging
import os
import pathlib
import subprocess
import sys
import tempfile

def load_create_cloudhub():
    """Its helpers, loaded when run rather than imported, as it needs the installed protobufs."""
    spec = importlib.util.spec_from_file_location(
        "jaia_create_cloudhub",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "jaia-create-cloudhub.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# The description jaia-support-access.py gives its own rules; EC2 matches on it
SUPPORT_RULE_DESCRIPTION = "jaia support access"
EVERYWHERE = ("0.0.0.0/0", "::/0")
# Keep in sync with create_vpc.sh and jaia_configure_authelia.sh
DEFAULT_SMTP_CREDENTIALS_PARAMETER = "/jaia/cloudhub/smtp_credentials"
# Keep in sync with the major upgrade's hub-stage-fleet-config.yml
MAJOR_UPGRADE_PREFIX = "jaia/major_upgrade"


def aws(env, *args):
    result = subprocess.run(["aws", *args, "--output", "json"], capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise RuntimeError("aws {}: {}".format(" ".join(args[:2]), result.stderr.strip()))
    return json.loads(result.stdout) if result.stdout.strip() else {}


def find_vpc(env, fleet_id, customer):
    """By fleet alone, as the customer a CloudHub was created under need not be the
    one in its fleet config; the customer only chooses between several."""
    vpcs = aws(env, "ec2", "describe-vpcs", "--filters",
               "Name=tag:jaia_fleet,Values={}".format(fleet_id))["Vpcs"]
    if len(vpcs) > 1 and customer:
        vpcs = [v for v in vpcs
                if {"Key": "jaia_customer", "Value": customer} in v.get("Tags", [])]
    if len(vpcs) != 1:
        found = ", ".join(v["VpcId"] for v in vpcs) or "none"
        hint = "; name the customer it was created for to choose one" if len(vpcs) > 1 else ""
        raise RuntimeError("expected one VPC tagged jaia_fleet={}{}, found {}{}".format(
            fleet_id, " and jaia_customer=" + customer if customer and len(vpcs) != 1 else "",
            found, hint))
    return vpcs[0]["VpcId"]


def find_security_group(env, vpc_id):
    groups = aws(env, "ec2", "describe-security-groups", "--filters",
                 "Name=vpc-id,Values={}".format(vpc_id),
                 "Name=group-name,Values=jaia__SecurityGroup_CloudHub__*")["SecurityGroups"]
    if len(groups) != 1:
        raise RuntimeError("expected one CloudHub security group in {}, found {}".format(
            vpc_id, len(groups)))
    return groups[0]


def render_policy(template_path, values):
    with open(template_path) as f:
        text = f.read()
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return json.loads(text)


def fleet_config_problem(fleet_config_tool, path):
    """Why the major upgrade would refuse the config, or None. An earlier version
    passes if it migrates, as the upgrade migrates what it stages."""
    result = subprocess.run([sys.executable, fleet_config_tool, "validate", path],
                            capture_output=True, text=True)
    if result.returncode != 0:
        return (result.stderr.strip() or result.stdout.strip()
                or "{} validate failed".format(fleet_config_tool))
    return None


def major_upgrade_uri(bucket, fleet_id):
    return "s3://{}/{}/fleet{}.cfg".format(bucket, MAJOR_UPGRADE_PREFIX, fleet_id)


def upload_fleet_config(env, bucket, fleet_id, path, dry_run, logger):
    uri = major_upgrade_uri(bucket, fleet_id)
    logger.info("Fleet config {} {} {}".format(path, "would be uploaded to" if dry_run else "is uploaded to", uri))
    if not dry_run:
        # s3 cp writes progress, not JSON, to stdout unless told not to
        aws(env, "s3", "cp", "--only-show-errors", path, uri)
    return uri


def stray_ssh_rules(group):
    """Port 22 open to every address under any description but the support tool's:
    an earlier release left one in place, and the support tool closes only its own."""
    stray = []
    for perm in group.get("IpPermissions", []):
        if perm.get("IpProtocol") != "tcp" or perm.get("FromPort") != 22 or perm.get("ToPort") != 22:
            continue
        for key, cidr_key in (("IpRanges", "CidrIp"), ("Ipv6Ranges", "CidrIpv6")):
            for rng in perm.get(key, []):
                if rng.get(cidr_key) in EVERYWHERE and rng.get("Description") != SUPPORT_RULE_DESCRIPTION:
                    stray.append({"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, key: [rng]})
    return stray


def main():
    create = load_create_cloudhub()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("fleetcfg", help="Path to the fleet configuration file the CloudHub belongs to")
    parser.add_argument("customer", nargs="?", help="Customer the CloudHub was created for, needed "
                        "only if more than one VPC is tagged with this fleet")
    parser.add_argument("--region", type=str, help="AWS region the CloudHub is in (default: {})".format(
        create.DEFAULT_REGION))
    parser.add_argument("--govcloud", action="store_true", help="Shorthand for --region {}".format(
        create.GOVCLOUD_REGION))
    parser.add_argument("--aws-profile", type=str, help="AWS profile to authenticate with (default: "
                        "$AWS_PROFILE, otherwise a per-region default). Pass an empty string to use "
                        "credentials from the environment instead.")
    parser.add_argument("--jaiabot-dir", type=str, help="Path to the JaiaBot checkout holding "
                        "rootfs/cloud/aws (default: the checkout this script is in)")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without changing it")
    parser.add_argument("--binary", help=argparse.SUPPRESS)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger = logging.getLogger()

    jaiabot_dir = create.resolve_jaiabot_dir(args, os.path.dirname(os.path.abspath(__file__)), logger)
    fleet_cfg = create.read_fleet_from_textproto(args.fleetcfg)
    fleet_id = fleet_cfg.fleet
    cloudhub_id = int(subprocess.run(["jaia_bounds", "--cloudhub_id"],
                                     capture_output=True, text=True, check=True).stdout)
    if cloudhub_id not in fleet_cfg.hubs:
        sys.exit("Fleet {} has no CloudHub (hub {}) in {}".format(fleet_id, cloudhub_id, args.fleetcfg))

    problem = fleet_config_problem(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "jaia-fleet-config.py"),
        args.fleetcfg)
    if problem:
        sys.exit("ERROR: {} cannot be used for the major upgrade:\n{}".format(args.fleetcfg, problem))

    region = create.resolve_region(args, logger)
    env = create.aws_env(region, create.resolve_aws_profile(args, region))
    customer = args.customer
    arn_prefix = "arn:aws-us-gov" if create.is_govcloud(region) else "arn:aws"

    try:
        account_id = aws(env, "sts", "get-caller-identity")["Account"]
        vpc_id = find_vpc(env, fleet_id, customer)
        group = find_security_group(env, vpc_id)
    except RuntimeError as e:
        sys.exit("ERROR: {}".format(e))

    data_bucket = fleet_cfg.cloudhub.data_bucket or create.default_data_bucket(fleet_id)
    smtp_parameter = fleet_cfg.cloudhub.smtp_credentials_ssm_parameter or DEFAULT_SMTP_CREDENTIALS_PARAMETER
    if not smtp_parameter.startswith("arn:"):
        smtp_parameter = "{}:ssm:{}:{}:parameter/{}".format(arn_prefix, region, account_id,
                                                            smtp_parameter.lstrip("/"))
    policy = render_policy(
        pathlib.Path(jaiabot_dir) / "rootfs/cloud/aws/cloudhub-iam-policy.json.in",
        {"REGION": region, "ACCOUNT_ID": account_id, "VPC_ID": vpc_id,
         "CLOUDHUB_SECURITY_GROUP_ID": group["GroupId"],
         "CLOUDHUB_DATA_BUCKET": data_bucket,
         "ARN_PREFIX": arn_prefix, "SMTP_CREDENTIALS_PARAMETER_ARN": smtp_parameter})

    role = "JaiaCloudHubFleet{}__Role".format(fleet_id)
    policy_name = "JaiaCloudHubFleet{}__Policy".format(fleet_id)
    try:
        current = aws(env, "iam", "get-role-policy", "--role-name", role,
                      "--policy-name", policy_name)["PolicyDocument"]
    except RuntimeError as e:
        sys.exit("ERROR: could not read the CloudHub's policy {} on {}: {}".format(policy_name, role, e))

    logger.info("CloudHub of fleet {} in {}: VPC {}, security group {}, role {}".format(
        fleet_id, region, vpc_id, group["GroupId"], role))
    policy_changed = current != policy
    if not policy_changed:
        logger.info("Its policy is already current")
    else:
        have = {s.get("Sid") for s in current.get("Statement", [])}
        want = {s.get("Sid") for s in policy["Statement"]}
        logger.info("Its policy {} current: adds {}, drops {}, and rewrites any statement that differs".format(
            "would be made" if args.dry_run else "is made",
            ", ".join(sorted(want - have)) or "nothing", ", ".join(sorted(have - want)) or "nothing"))
        if not args.dry_run:
            with tempfile.NamedTemporaryFile("w", suffix=".json") as f:
                json.dump(policy, f)
                f.flush()
                aws(env, "iam", "put-role-policy", "--role-name", role, "--policy-name", policy_name,
                    "--policy-document", "file://" + f.name)

    stray = stray_ssh_rules(group)
    for perm in stray:
        cidr = (perm.get("IpRanges") or perm.get("Ipv6Ranges"))[0]
        logger.info("Port 22 open to {} ({}) {}".format(
            cidr.get("CidrIp") or cidr.get("CidrIpv6"), cidr.get("Description") or "no description",
            "would be closed" if args.dry_run else "is closed"))
    if stray and not args.dry_run:
        aws(env, "ec2", "revoke-security-group-ingress", "--group-id", group["GroupId"],
            "--ip-permissions", json.dumps(stray))
    if not stray:
        logger.info("No stray port 22 rule")

    try:
        upload_fleet_config(env, data_bucket, fleet_id, args.fleetcfg, args.dry_run, logger)
    except RuntimeError as e:
        sys.exit("ERROR: could not upload the fleet config: {}".format(e))

    if policy_changed and not args.dry_run:
        logger.info("IAM changes can take a minute or two to apply: until then the CloudHub may "
                    "be refused when it opens fleet pairing or support access, so wait before retrying")
    return 0


if __name__ == "__main__":
    sys.exit(main())
