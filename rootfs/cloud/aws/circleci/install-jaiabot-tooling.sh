#!/bin/bash

# Installs the jaiabot tooling a sea trial drives the fleet with, from the same
# packages.jaia.tech repo the image under test comes from.
#
# Reads JAIA_CI_REPO and JAIABOT_APT_VERSION from the environment.

set -u -e

sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x19478082E2F8D3FE" \
    | sudo gpg --dearmor -o /etc/apt/keyrings/gobysoft.gpg
curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x954A004CD5D8CF32" \
    | sudo gpg --dearmor -o /etc/apt/keyrings/jaiabot.gpg

codename=$(lsb_release -c -s)

# the same repo the image comes from: tooling from a different one writes answers the
# image's packages no longer accept, or lacks flags entirely
echo "deb [signed-by=/etc/apt/keyrings/gobysoft.gpg] http://packages.jaia.tech/ubuntu/gobysoft/${JAIA_CI_REPO}/${JAIABOT_APT_VERSION} ${codename}/" \
    | sudo tee /etc/apt/sources.list.d/gobysoft.list
echo "deb [signed-by=/etc/apt/keyrings/jaiabot.gpg] http://packages.jaia.tech/ubuntu/${JAIA_CI_REPO}/${JAIABOT_APT_VERSION} ${codename}/" \
    | sudo tee /etc/apt/sources.list.d/jaiabot.list

sudo apt-get update
# jaiabot-python's postinst pip-installs pyjaia, so this step needs PyPI
sudo apt-get install -y jaiabot-apps jaiabot-python wireguard wireguard-tools \
    cloud-init ansible jq rsync

# the images point python3 at pyenv, which cannot see the protobuf bindings these
# packages install for the system interpreter
if command -v pyenv > /dev/null; then pyenv global system; fi
python3 -c "import sys; from google.protobuf import text_format; print('protobuf bindings visible to', sys.executable)"

echo "installed jaiabot: $(jaia version 2>&1 | sed -n 2p)"

# a one-line failure here beats an argparse dump from inside the create step
if ! jaia admin fleet create_cloudhub --help | grep -q -- --permissions-boundary; then
    echo "ERROR: installed tooling predates this checkout; it cannot drive this trial" >&2
    exit 1
fi
