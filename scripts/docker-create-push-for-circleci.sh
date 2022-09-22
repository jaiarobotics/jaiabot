#!/usr/bin/env bash

script_dir=$(dirname $0)
cd ${script_dir}/..

docker build --no-cache -t gobysoft/jaiabot-ubuntu-arm64:20.04.1 .docker/focal/arm64
docker push gobysoft/jaiabot-ubuntu-arm64:20.04.1

docker build --no-cache -t gobysoft/jaiabot-ubuntu-amd64:20.04.1 .docker/focal/amd64
docker push gobysoft/jaiabot-ubuntu-amd64:20.04.1
