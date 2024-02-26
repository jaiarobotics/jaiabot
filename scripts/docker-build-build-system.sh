#!/usr/bin/env bash

set -e


script_dir=$(dirname $0)
jaia_root=${script_dir}/..
if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    docker build --no-cache -t build_system_vbox ${jaia_root}/.docker/focal/amd64
else
    docker build --no-cache -t build_system ${jaia_root}/.docker/focal/arm64
fi
