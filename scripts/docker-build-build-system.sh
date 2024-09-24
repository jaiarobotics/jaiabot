#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
jaia_root=${script_dir}/..

default_version=$(<${script_dir}/release_branch)
repo=${jaiabot_repo:-release}
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
default_distro=$(<ubuntu_release)
distro=${jaiabot_distro:-${default_distro}}

if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_vbox_${distro}_${repo}_${version_lower} ${jaia_root}/.docker/${distro}/amd64  
else
    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_${distro}_${repo}_${version_lower} ${jaia_root}/.docker/${distro}/arm64
fi
