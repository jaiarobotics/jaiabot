#!/bin/bash

# intended to be run within a bare (e.g. ubuntu:focal) docker container
# docker run --rm -v /path/to/jaiabot:/jaiabot -w /jaiabot ubuntu:focal scripts/bundle_update.sh focal continuous 1.y

# see also https://npmccallum.gitlab.io/post/foreign-architecture-docker/

set -e -u

DESIRED_PACKAGES="jaiabot-embedded"
DISTRO="$1"
REPO="$2"
VERSION="$3"
WORKING_DIR="./build/bundle"

mkdir -p ${WORKING_DIR}

# Bare minimum to allow us to get keys. Do not add anything else
# here or the apt-get install --download-only will be missing potential desired dependencies!
apt-get update && \
    apt-get -y --no-install-recommends install \
            gpg gpg-agent dirmngr

echo -e "deb http://packages.jaia.tech/ubuntu/${REPO}/${VERSION}/ ${DISTRO}/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/${REPO}/${VERSION}/ ${DISTRO}/" >> /etc/apt/sources.list.d/jaiabot_release_${VERSION}.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

apt-get update 

# Call install, but with download-only, because it will fetch the dependencies where apt-get download only grabs a single package
apt-get install --download-only -o Dir::Cache::archives="${WORKING_DIR}" ${DESIRED_PACKAGES} -y

cd ${WORKING_DIR}
apt-get -y install dpkg-dev
dpkg-scanpackages . > Packages

# Generate pip wheels

## Don't install python3-pip until after the apt-get install download (to ensure all python .deb dependencies are included
## in previous steps)
apt-get -y install python3-pip
### Match the requirements in jaiabot-python.postinst
pip3 wheel wheel -w .
pip3 wheel -r /jaiabot/src/python/requirements.txt -w .

# Generate ISO
apt-get -y install genisoimage
genisoimage -V updates -r -o ../jaiabot_updates.iso .

# tar
tar cfv ../jaiabot_updates.tar .
