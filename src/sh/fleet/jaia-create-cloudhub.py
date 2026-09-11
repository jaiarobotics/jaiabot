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

LOG_LEVELS = {
    'critical': logging.CRITICAL,
    'error': logging.ERROR,
    'warning': logging.WARNING,
    'info': logging.INFO,
    'debug': logging.DEBUG,
}

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
    parser.add_argument('--govcloud', help="Use GovCloud AWS Region us-gov-east-1 instead of us-east-1", action="store_true")
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
    region='us-east-1'
    a_zone='us-east-1c'
    if args.govcloud:
        region='us-gov-east-1'
        a_zone='us-gov-east-1a'
    
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

    logger.info(f"Running create_vpc.sh ...")

    aws_profile='jaiacreatevpc'
    if args.govcloud:
        aws_profile='jaiagovcloudcreatevpc'

    env = os.environ.copy()
    env |= {"AWS_DEFAULT_REGION": region, "AWS_PROFILE": f"{aws_profile}"}
    subprocess.run(
        f'./create_vpc.sh {vpc_conffile}',
        cwd=aws_cloud_script_dir,
        env=env,
        shell=True,
        capture_output=False)

if __name__ == "__main__":
    main()
