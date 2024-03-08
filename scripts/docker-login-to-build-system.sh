#!/usr/bin/env bash

jaia_dir=$(dirname $0)/../

docker run -iv ${jaia_dir}:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t build_system bash

