#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
jaia_root=${script_dir}/..

set -a; source ${script_dir}/common-versions.env; set +a 
(cd ..; cmake -P cmake/ConfigureDockerfiles.cmake)

default_version=${jaia_version_release_branch}
repo=${jaiabot_repo:-release}
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}

if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_vbox_${distro}_${repo}_${version_lower} ${jaia_root}/.docker/${distro}/amd64  
else
    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_${distro}_${repo}_${version_lower} ${jaia_root}/.docker/${distro}/arm64
fi
