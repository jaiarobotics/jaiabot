#!/usr/bin/env python3
"""The jaiabot-offline-base-map version for this commit, and whether the apt repo this
CircleCI pipeline uploads to already has it. Reads the variables the CircleCI jobs set.

  ci.py version             e.g. 5.1.2+3+ubuntu26.04
  ci.py published VERSION   exits 0 if the repo has jaiabot-offline-base-map VERSION
"""

import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACKAGE = "jaiabot-offline-base-map"


def natural_earth_version():
    for line in (HERE.parent / "scripts" / "common-versions.env").read_text().splitlines():
        if line.startswith("jaia_version_natural_earth="):
            return line.split("=", 1)[1]
    sys.exit("scripts/common-versions.env has no jaia_version_natural_earth")


def version():
    # --full-history: with history simplification, a later merge can drop commits and lower the count
    changes = subprocess.run(
        ["git", "rev-list", "--count", "--full-history", "HEAD", "--", "."],
        cwd=HERE, check=True, capture_output=True, text=True,
    ).stdout.strip()
    return f"{natural_earth_version()}+{changes}+{os.environ['DISTRO_RELEASE_VERSION']}"


def packages_index():
    url = (f"http://packages.jaia.tech/ubuntu/{os.environ['JAIABOT_APT_REPO']}/"
           f"{os.environ['JAIABOT_APT_VERSION']}/{os.environ['DISTRO_RELEASE_CODENAME']}/Packages")
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            return response.read().decode()
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return ""
        raise


def published(package_version):
    for stanza in packages_index().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in stanza.splitlines() if ": " in line and not line[0].isspace())
        if fields.get("Package") == PACKAGE and fields.get("Version") == package_version:
            return True
    return False


def main():
    if sys.argv[1:] == ["version"]:
        print(version())
    elif len(sys.argv) == 3 and sys.argv[1] == "published":
        sys.exit(0 if published(sys.argv[2]) else 1)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
