#!/usr/bin/env python3

import sys
import os

def set_pythonpath():
    script_path = os.path.abspath(__file__)
    script_dir = os.path.dirname(script_path)
    python_path = os.path.join(script_dir, "../share/jaiabot/python/pyjaiaprotobuf/src")

    # Resolve to an absolute path and add to sys.path if valid
    if python_path:
        python_path = os.path.abspath(python_path)
        if os.path.exists(python_path):
            sys.path.insert(0, python_path)
        else:
            print(f"Warning: {python_path} does not exist")
            sys.exit(1)

set_pythonpath()

import json
from google.protobuf import text_format, json_format
from jaiabot.messages.fleet_config_pb2 import FleetConfig
import subprocess
import argparse
import logging
import pathlib
import random

LOG_LEVELS = {
    'critical': logging.CRITICAL,
    'error': logging.ERROR,
    'warning': logging.WARNING,
    'info': logging.INFO,
    'debug': logging.DEBUG,
}

DEFAULT_REGION = 'us-east-1'
GOVCLOUD_REGION = 'us-gov-east-1'

# matches the default in config/ansible/cloud/create-virtualfleet.yml
DEFAULT_VIRTUALFLEET_INSTANCE_TYPE = 't3a.small'


def is_govcloud(region):
    return region.startswith('us-gov-')


def resolve_region(args, logger):
    if args.govcloud:
        if args.region is not None and not is_govcloud(args.region):
            logger.error(f"ERROR: --govcloud conflicts with --region {args.region}")
            exit(1)
        return args.region or GOVCLOUD_REGION
    return args.region or DEFAULT_REGION


def resolve_aws_profile(args, region):
    """The caller's own profile wins, so CI can authenticate with its OIDC profile, or
    with credentials in the environment by passing an empty --aws-profile."""
    if args.aws_profile is not None:
        return args.aws_profile
    if 'AWS_PROFILE' in os.environ:
        return os.environ['AWS_PROFILE']
    return 'jaiagovcloudcreatevpc' if is_govcloud(region) else 'jaiacreatevpc'


def aws_env(region, profile):
    env = os.environ.copy()
    env['AWS_DEFAULT_REGION'] = region
    if profile:
        env['AWS_PROFILE'] = profile
    else:
        env.pop('AWS_PROFILE', None)
    return env


def aws_ec2_text_query(region, profile, *args):
    env = aws_env(region, profile)
    result = subprocess.run(['aws', 'ec2', *args, '--region', region, '--output', 'text'],
                            capture_output=True, text=True, check=True, env=env)
    return set(result.stdout.split())


def choose_availability_zone(region, profile, instance_types, logger):
    """A zone of the region chosen at random from those offering every instance type.

    Both subnets are created in this zone, so a zone that cannot host the VirtualFleet
    fails only once the CloudHub is already built - t3a is absent from ca-central-1d.
    """
    zones = aws_ec2_text_query(region, profile, 'describe-availability-zones',
                               '--query', 'AvailabilityZones[?State==`available`].ZoneName')
    for instance_type in instance_types:
        offered = aws_ec2_text_query(
            region, profile, 'describe-instance-type-offerings',
            '--location-type', 'availability-zone',
            '--filters', f'Name=instance-type,Values={instance_type}',
            '--query', 'InstanceTypeOfferings[].Location')
        if not zones & offered:
            logger.error(f"ERROR: no availability zone in {region} offers {instance_type} "
                         f"alongside the other requested instance types "
                         f"(candidate zones were {sorted(zones)})")
            exit(1)
        zones &= offered
    return random.choice(sorted(zones))


def read_fleet_from_textproto(file_path):
    fleet_cfg = FleetConfig()
    with open(file_path, "r") as f:
        text_format.Parse(f.read(), fleet_cfg)
    return json.loads(json_format.MessageToJson(fleet_cfg))


def is_git_repo_subprocess(path):
    """Check if the given path is a part of a Git repository using subprocess."""
    try:
        # Use git -C <path> to run the command from the specified directory.
        # Redirect stdout and stderr to os.devnull to prevent output to the console.
        subprocess.check_call(
            ['git', '-C', path, 'rev-parse', '--is-inside-work-tree'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except subprocess.CalledProcessError:
        # A CalledProcessError means the command returned a non-zero exit code (not a git repo).
        return False
    except FileNotFoundError:
        # Handle the case where 'git' executable is not found in the system's PATH.
        print("Error: Git executable not found. Make sure Git is installed and in your PATH.")
        return False


def main():
    parser = argparse.ArgumentParser(description="Jaia Fleet CloudHub creation (including VPC)")
    parser.add_argument('fleetcfg',  help="Path to fleet configuration file (protobuf TextFormat version of FleetConfig)")
    parser.add_argument('customer', help="Customer name for AWS tagging")
    parser.add_argument('--quiet', '-q',  help="Do not output debugging information", action="store_true")
    parser.add_argument("--loglevel", help="Set logging level", choices=LOG_LEVELS.keys(), default='info')
    parser.add_argument('--binary', type=str, help="Name of binary")
    parser.add_argument('--instance-type', type=str, help="AWS Instance type for CloudHub", default="t3a.micro")
    parser.add_argument('--region', type=str, help=f"AWS region to create the CloudHub in (default: {DEFAULT_REGION}). A jaiabot AMI must be available in this region.")
    parser.add_argument('--availability-zone', type=str, help="AWS availability zone for the CloudHub and VirtualFleet subnets (default: a zone of the region chosen at random from those offering both instance types)")
    parser.add_argument('--virtualfleet-instance-type', type=str, help=f"AWS instance type the VirtualFleet will be created with, which constrains the availability zone chosen (default: {DEFAULT_VIRTUALFLEET_INSTANCE_TYPE})", default=DEFAULT_VIRTUALFLEET_INSTANCE_TYPE)
    parser.add_argument('--aws-profile', type=str, help="AWS profile to authenticate with (default: $AWS_PROFILE, otherwise a per-region default). Pass an empty string to use credentials from the environment instead.")
    parser.add_argument('--output-json', type=str, help="Write the IDs of the created AWS resources to this path as JSON")
    parser.add_argument('--govcloud', help=f"Shorthand for --region {GOVCLOUD_REGION}", action="store_true")
    parser.add_argument('--repo', help="Jaiabot Repo", default="release", choices=["release", "beta", "continuous", "test"])
    parser.add_argument('--disk-size-gb', help="CloudHub disk size in GB", default=32, type=int)
    parser.add_argument('--no-enable-client-vpn', help="If set, do not create a client vpn configuration on this machine", action="store_true")
    parser.add_argument('--no-update-client-etc-hosts', help="If set, do not add a local entry for the new CloudHub in this machine's /etc/hosts", action="store_true")    
    args = parser.parse_args()
    
    loglevel = args.loglevel
    if args.quiet:
        loglevel = 'error'
    logger = logging.getLogger()
    logger.setLevel(LOG_LEVELS[loglevel])
    formatter = logging.Formatter(
        fmt="%(levelname)-8s %(filename)-15s %(message)s"
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not is_git_repo_subprocess(script_dir):
        logger.error("ERROR: This action can only currently only be performed in the Git checkout of JaiaBot")
        exit(1)

    jaiabot_dir = subprocess.run(
        ["git", '-C',  script_dir, "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True).stdout.strip()
    
    aws_cloud_script_dir = pathlib.Path(jaiabot_dir) / 'rootfs/cloud/aws'
    fleet_cfg = read_fleet_from_textproto(args.fleetcfg)

    cloudhub_id = int(subprocess.run(['jaia_bounds', '--cloudhub_id'],
                                     capture_output=True, text=True, check=True).stdout)
    fleet_id=fleet_cfg["fleet"]
    hubs=fleet_cfg["hubs"]
    if not cloudhub_id in hubs:
        logger.error(f"ERROR: Fleet config must contain hub {cloudhub_id}")
        exit(1)
    
    logger.info(f"Creating CloudHub (Hub {cloudhub_id}) for Fleet {fleet_id}")

    vpc_conffile = aws_cloud_script_dir / f'vpc.conf.fleet{fleet_id}'
    logger.info(f"Generating config file for create_vpc.sh: {vpc_conffile}")
    region = resolve_region(args, logger)
    aws_profile = resolve_aws_profile(args, region)
    a_zone = args.availability_zone or choose_availability_zone(
        region, aws_profile, [args.instance_type, args.virtualfleet_instance_type], logger)
    logger.info(f"Using AWS region {region}, availability zone {a_zone}")

    with open(vpc_conffile, 'w') as f:
        debug='false'
        if loglevel in ['info', 'debug']:
            debug='true'

        fleet_cfg_full_path=pathlib.Path(args.fleetcfg).resolve()
        f.write(f"DEBUG={debug}\n")
        f.write(f"JAIA_CUSTOMER_NAME={args.customer}\n")
        f.write(f'INSTANCE_TYPE="{args.instance_type}"\n')
        f.write(f'FLEET_ID={fleet_id}\n')
        f.write(f'REGION={region}\n')
        f.write(f'AVAILABILITY_ZONE={a_zone}\n')
        f.write(f'REPO={args.repo}\n')
        f.write(f'DISK_SIZE_GB={args.disk_size_gb}\n')
        f.write('CLOUDHUB_DATA_BUCKET="jaia--cloudhub-data--fleet${FLEET_ID}"\n')
        f.write(f'JCC_HUB_ID={cloudhub_id}\n')
        f.write(f'FLEET_CONFIG={fleet_cfg_full_path}\n')

        enable_client_vpn='true'
        if args.no_enable_client_vpn:
            enable_client_vpn='false'
        f.write(f'ENABLE_CLIENT_VPN={enable_client_vpn}\n')
            
        update_client_etc_hosts='true'
        if args.no_update_client_etc_hosts:
            update_client_etc_hosts='false'                
        f.write(f'UPDATE_CLIENT_ETC_HOSTS={update_client_etc_hosts}\n')

        if args.output_json:
            f.write(f'OUTPUT_JSON={pathlib.Path(args.output_json).resolve()}\n')

    logger.info(f"Running create_vpc.sh ...")

    process = subprocess.Popen(['./create_vpc.sh', str(vpc_conffile)], cwd=aws_cloud_script_dir, env=aws_env(region, aws_profile))
    # create_vpc.sh also receives Ctrl-C and rolls back; don't kill it or exit before it finishes
    while True:
        try:
            returncode = process.wait()
            break
        except KeyboardInterrupt:
            logger.warning("Interrupted, waiting for create_vpc.sh to clean up and exit ...")
    sys.exit(returncode)

if __name__ == "__main__":
    main()
