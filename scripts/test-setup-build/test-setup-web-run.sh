#!/usr/bin/env bash

set -e

script_dir=$(dirname $0)
jaia_root=${script_dir}/../../
(cd ${jaia_root}; cmake -P cmake/ConfigureDockerfiles.cmake)

docker build -t test_setup_script .

docker run -iv ${jaia_root}:/home/jaia/jaiabot -w /home/jaia/jaiabot -t test_setup_script bash -c 'source ./scripts/setup-tools-build-nodocker.sh && cd src/web && ./run.sh'
