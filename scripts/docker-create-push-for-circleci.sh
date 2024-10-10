#!/usr/bin/env bash

set -e -u -x

##  "Usage: $0 [jammy|focal] [1.y]"

script_dir=$(dirname $0)
set -a; source ${script_dir}/common-versions.env; set +a 
(cd ..; cmake -P cmake/ConfigureDockerfiles.cmake)

distro=${1:-${jaia_version_ubuntu_codename}}
release_branch=${2:-${jaia_version_release_branch}}

if [[ "$distro" = "jammy" ]]; then
    version=22.04.1
elif [[ "$distro" = "focal" ]]; then
    version=20.04.1
else
    echo "Distro $distro is not supported"
    exit 1
fi   

script_dir=$(dirname $0)
cd ${script_dir}/..

docker build --build-arg distro=$distro --build-arg version=$release_branch --no-cache -t gobysoft/jaiabot-ubuntu-arm64:${version} .docker/${distro}/arm64
docker push gobysoft/jaiabot-ubuntu-arm64:${version}

docker build --build-arg distro=$distro --build-arg version=$release_branch --no-cache -t gobysoft/jaiabot-ubuntu-amd64:${version} .docker/${distro}/amd64
docker push gobysoft/jaiabot-ubuntu-amd64:${version}
