#!/usr/bin/env python3

import sys
import os
import subprocess
import argparse
import logging
import pathlib

DEFAULT_REGION = 'us-east-1'
GOVCLOUD_REGION = 'us-gov-east-1'


def is_govcloud(region):
    return region.startswith('us-gov-')


def resolve_region(args):
    if args.govcloud:
        if args.region is not None and not is_govcloud(args.region):
            print(f"ERROR: --govcloud conflicts with --region {args.region}")
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


def resolve_jaiabot_dir(args, script_dir, logger):
    """The checkout holding rootfs/cloud/aws, which is not necessarily where this script
    lives: installed from a package it runs from /usr/bin, against a checkout elsewhere."""
    if args.jaiabot_dir:
        jaiabot_dir = os.path.abspath(args.jaiabot_dir)
    elif is_git_repo_subprocess(script_dir):
        jaiabot_dir = subprocess.run(
            ["git", '-C', script_dir, "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True).stdout.strip()
    else:
        logger.error("ERROR: run this from a JaiaBot checkout, or pass --jaiabot-dir")
        exit(1)

    if not (pathlib.Path(jaiabot_dir) / 'rootfs/cloud/aws/create_vpc.sh').exists():
        logger.error(f"ERROR: {jaiabot_dir} is not a JaiaBot checkout "
                     "(no rootfs/cloud/aws/create_vpc.sh)")
        exit(1)
    return jaiabot_dir


def main():
    parser = argparse.ArgumentParser(description="Jaia Fleet CloudHub deletion (including VPC)")
    parser.add_argument('fleetid',  help="Fleet ID")
    parser.add_argument('--binary', type=str, help="Name of binary")
    parser.add_argument('--region', type=str, help=f"AWS region the CloudHub was created in (default: {DEFAULT_REGION})")
    parser.add_argument('--govcloud', help=f"Shorthand for --region {GOVCLOUD_REGION}", action="store_true")
    parser.add_argument('--aws-profile', type=str, help="AWS profile to authenticate with (default: $AWS_PROFILE, otherwise a per-region default). Pass an empty string to use credentials from the environment instead.")
    parser.add_argument('--yes', '-y', help="Do not ask for confirmation", action="store_true")
    parser.add_argument('--keep-iam', help="Leave the CloudHub's IAM role and instance profile in place", action="store_true")
    parser.add_argument('--jaiabot-dir', type=str, help="Path to the JaiaBot checkout holding rootfs/cloud/aws (default: the checkout this script is in)")
    args = parser.parse_args()

    logging.basicConfig(format="%(levelname)-8s %(message)s", level=logging.INFO)
    logger = logging.getLogger()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    jaiabot_dir = resolve_jaiabot_dir(args, script_dir, logger)
    aws_cloud_script_dir = pathlib.Path(jaiabot_dir) / 'rootfs/cloud/aws'

    region = resolve_region(args)
    aws_profile = resolve_aws_profile(args, region)

    env = os.environ.copy()
    env['AWS_DEFAULT_REGION'] = region
    if aws_profile:
        env['AWS_PROFILE'] = aws_profile
    else:
        env.pop('AWS_PROFILE', None)

    command = ['./delete_vpc.sh']
    if args.yes:
        command.append('--yes')
    if args.keep_iam:
        command.append('--keep-iam')
    command.append(str(args.fleetid))

    # a teardown that failed halfway must not report success, or its leak goes unnoticed
    sys.exit(subprocess.run(command, cwd=aws_cloud_script_dir, env=env).returncode)

if __name__ == "__main__":
    main()
