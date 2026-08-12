#!/usr/bin/env bash

set -e -u

##  "Usage: $0"

script_dir=$(dirname $BASH_SOURCE)
set -a; source ${script_dir}/../common-versions.env; set +a 

distro=${jaia_version_ubuntu_codename}
version=${jaia_version_ubuntu}
release_branch=${jaia_version_release_branch}

cd ${script_dir}/../..

docker build --build-arg distro=$distro --build-arg version=$release_branch --no-cache -t gobysoft/jaiabot-ubuntu-arm64:${version} .docker/${distro}/arm64
docker push gobysoft/jaiabot-ubuntu-arm64:${version}

docker build --build-arg distro=$distro --build-arg version=$release_branch --no-cache -t gobysoft/jaiabot-ubuntu-amd64:${version} .docker/${distro}/amd64
docker push gobysoft/jaiabot-ubuntu-amd64:${version}
