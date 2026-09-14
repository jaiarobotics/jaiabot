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


def aws_profile_for_region(region):
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


def main():
    parser = argparse.ArgumentParser(description="Jaia Fleet CloudHub deletion (including VPC)")
    parser.add_argument('fleetid',  help="Fleet ID")
    parser.add_argument('--binary', type=str, help="Name of binary")
    parser.add_argument('--region', type=str, help=f"AWS region the CloudHub was created in (default: {DEFAULT_REGION})")
    parser.add_argument('--govcloud', help=f"Shorthand for --region {GOVCLOUD_REGION}", action="store_true")

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not is_git_repo_subprocess(script_dir):
        logger.error("ERROR: This action can only currently only be performed in the Git checkout of JaiaBot")
        exit(1)

    jaiabot_dir = subprocess.run(
        ["git", '-C',  script_dir, "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True).stdout.strip()
    aws_cloud_script_dir = pathlib.Path(jaiabot_dir) / 'rootfs/cloud/aws'

    region = resolve_region(args)
    aws_profile = aws_profile_for_region(region)

    env = os.environ.copy()
    env |= {"AWS_DEFAULT_REGION": region, "AWS_PROFILE": f"{aws_profile}"}
    subprocess.run(
        f'./delete_vpc.sh {args.fleetid}',
        cwd=aws_cloud_script_dir,
        env=env,
        shell=True,
        capture_output=False)

if __name__ == "__main__":
    main()
