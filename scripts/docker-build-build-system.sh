#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
jaia_root=${script_dir}/..

set -a; source ${script_dir}/common-versions.env; set +a 
(cd ${jaia_root}; cmake -P cmake/ConfigureDockerfiles.cmake)

default_version=${jaia_version_release_branch}
repo=${jaiabot_repo:-release}
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}

# 1. Detect Host Architecture
host_arch=$(uname -m)

if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    echo "🔵 Building for VirtualBox (amd64)..."
    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_vbox_${distro}_${repo}_${version_lower} ${jaia_root}/.docker/${distro}/amd64  
else
    # 2. Choose the correct Dockerfile based on the Host
    if [[ "$host_arch" == "aarch64" || "$host_arch" == "arm64" ]]; then
        echo "🟢 Native ARM64 host detected (Apple Silicon/Multipass). Using native build context."
        docker_context_dir="${jaia_root}/.docker/${distro}/native-arm64"
    else
        echo "🟡 Intel/AMD64 host detected. Using cross-compilation build context."
        docker_context_dir="${jaia_root}/.docker/${distro}/arm64"
    fi

    docker build --build-arg distro=$distro --build-arg repo=$repo --build-arg version=$version --no-cache -t jaia_build_${distro}_${repo}_${version_lower} "$docker_context_dir"
fi