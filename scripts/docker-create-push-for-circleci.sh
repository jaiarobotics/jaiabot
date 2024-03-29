#!/usr/bin/env bash

set -e -u -x

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 [jammy|focal]"
    exit 1
fi

distro=$1

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

docker build --build-arg distro=$distro --no-cache -t gobysoft/jaiabot-ubuntu-arm64:${version} .docker/${distro}/arm64
docker push gobysoft/jaiabot-ubuntu-arm64:${version}

docker build --build-arg distro=$distro --no-cache -t gobysoft/jaiabot-ubuntu-amd64:${version} .docker/${distro}/amd64
docker push gobysoft/jaiabot-ubuntu-amd64:${version}
