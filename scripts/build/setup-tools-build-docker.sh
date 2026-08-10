#!/bin/bash

set -euo pipefail

script_dir=$(dirname $BASH_SOURCE)
set -a; source ${script_dir}/../common-versions.env; set +a 
sudo apt-get update && sudo apt-get install docker.io
# Verify that you can run docker commands without sudo
docker run hello-world
# Build the container
(cd ..; cmake -P cmake/ConfigureDockerfiles.cmake)
cd ../.docker/${jaia_version_ubuntu_codename}/arm64
docker build --build-arg distro=${jaia_version_ubuntu_codename} --build-arg version=${jaia_version_release_branch} --no-cache -t gobysoft/jaiabot-ubuntu-arm64:${jaia_version_ubuntu} .
# Optionally, push to docker hub
# docker push gobysoft/jaiabot-ubuntu-arm64:${jaia_version_ubuntu}
