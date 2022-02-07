#!/bin/bash

set -e

script_dir=$(dirname $0)
jaia_root=${script_dir}/..

docker build -t build_system ${jaia_root}/.docker/focal/arm64
