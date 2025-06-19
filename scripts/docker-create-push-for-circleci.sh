#!/usr/bin/env bash

set -e -u -x

##  "Usage: $0 [noble] [2.y]"

distro=$1
release_branch=$2

if [[ "$distro" = "noble" ]]; then
    version=24.04.1
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
