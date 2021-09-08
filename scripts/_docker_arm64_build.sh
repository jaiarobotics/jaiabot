#!/bin/bash -x

script_dir=$(dirname $0)

sudo rm -rf ${script_dir}/../build
cd ${script_dir}/..

docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 bash -c "apt update && apt upgrade -y && ./scripts/arm64_build.sh"

