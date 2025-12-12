#!/usr/bin/env python3

import sys
import os
import subprocess
import argparse
import logging
import pathlib

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
    parser.add_argument('--govcloud', help="Use GovCloud AWS Region us-gov-east-1 instead of us-east-1", action="store_true")

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not is_git_repo_subprocess(script_dir):
        logger.error("ERROR: This action can only currently only be performed in the Git checkout of JaiaBot")
        exit(1)

    jaiabot_dir = subprocess.run(
        ["git", '-C',  script_dir, "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True).stdout.strip()
    aws_cloud_script_dir = pathlib.Path(jaiabot_dir) / 'rootfs/cloud/aws'

    region='us-east-1'
    if args.govcloud:
        region='us-gov-east-1'

    aws_profile='jaiacreatevpc'
    if args.govcloud:
        aws_profile='jaiagovcloudcreatevpc'
        
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
