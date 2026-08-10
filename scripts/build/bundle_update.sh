#!/bin/bash

# intended to be run within a bare (e.g. ubuntu:focal) docker container
# docker run --rm -v /path/to/jaiabot:/jaiabot -w /jaiabot ubuntu:focal scripts/build/bundle_update.sh focal continuous 1.y

# see also https://npmccallum.gitlab.io/post/foreign-architecture-docker/

set -e -u

DESIRED_PACKAGES="jaiabot-embedded"
DISTRO="$1"
REPO="$2"
VERSION="$3"
WORKING_DIR="./build/bundle"

export DEBIAN_FRONTEND=noninteractive

mkdir -p ${WORKING_DIR}

# Bare minimum to allow us to get keys. Do not add anything else
# here or the apt-get install --download-only will be missing potential desired dependencies!
apt-get update && \
    apt-get -y --no-install-recommends install \
            gpg gpg-agent dirmngr


export GOBYSOFT_SIGNING_KEY=19478082E2F8D3FE
export JAIABOT_SIGNING_KEY=954A004CD5D8CF32
install -d -m 0755 /etc/apt/keyrings
gpg --keyserver keyserver.ubuntu.com --recv-keys ${GOBYSOFT_SIGNING_KEY} && gpg --export ${GOBYSOFT_SIGNING_KEY} > /etc/apt/keyrings/gobysoft.gpg
gpg --keyserver keyserver.ubuntu.com --recv-keys ${JAIABOT_SIGNING_KEY} && gpg --export ${JAIABOT_SIGNING_KEY} > /etc/apt/keyrings/jaiabot.gpg

echo -e "deb [signed-by=/etc/apt/keyrings/jaiabot.gpg] http://packages.jaia.tech/ubuntu/${REPO}/${VERSION}/ ${DISTRO}/\ndeb [signed-by=/etc/apt/keyrings/gobysoft.gpg] http://packages.jaia.tech/ubuntu/gobysoft/${REPO}/${VERSION}/ ${DISTRO}/" >> /etc/apt/sources.list.d/jaiabot_release_${VERSION}.list

apt-get update 

# Call install, but with download-only, because it will fetch the dependencies where apt-get download only grabs a single package
apt-get install --download-only -o Dir::Cache::archives="${WORKING_DIR}" ${DESIRED_PACKAGES} -y

cd ${WORKING_DIR}
apt-get -y install dpkg-dev
dpkg-scanpackages . > Packages

# Generate pip wheels

## Don't install python3-pip until after the apt-get install download (to ensure all python .deb dependencies are included
## in previous steps)
apt-get -y install python3-pip libgdal-dev python3-venv
### Match the requirements in jaiabot-python.postinst
/usr/bin/python3 -m venv venv
source venv/bin/activate
pip3 install -U pip wheel setuptools
pip3 wheel pip -w .
pip3 wheel setuptools -w .
pip3 wheel wheel -w .
# remove local (./pyjaia, etc.) requirements - these are already in jaiabot-python
pip3 wheel -r <(sed '/^\.\//d' /jaiabot/src/python/requirements.txt) -w .

# Generate ISO
apt-get -y install genisoimage
genisoimage -V updates -r -o ../jaiabot_updates.iso .

# tar
tar cfv ../jaiabot_updates.tar .
