#!/bin/bash

# intended to be run within a bare (e.g. ubuntu:focal) docker container
# docker run --rm -v `pwd`:/work -w /work ubuntu:focal ./bundle_update.sh

# see also https://npmccallum.gitlab.io/post/foreign-architecture-docker/

DESIRED_PACKAGES="jaiabot-embedded"
SERIES="continuous"
DISTRO="focal"
WORKING_DIR="./output"

mkdir -p ${WORKING_DIR}

apt-get update && \
    apt-get -y --no-install-recommends install \
            gpg gpg-agent dirmngr dpkg-dev

echo -e "deb http://packages.jaia.tech/ubuntu/${SERIES}/1.y/ ${DISTRO}/\ndeb http://packages.jaia.tech/ubuntu/gobysoft/1.y/ ${DISTRO}/" >> /etc/apt/sources.list.d/jaiabot_release_1.y.list && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 954A004CD5D8CF32 && \
    apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE

apt-get update 

# Call install, but with download-only, because it will fetch the dependencies where apt-get download only grabs a single package
apt-get install --download-only -o Dir::Cache::archives="${WORKING_DIR}" ${DESIRED_PACKAGES} -y

cd ${WORKING_DIR}
dpkg-scanpackages . > Packages
