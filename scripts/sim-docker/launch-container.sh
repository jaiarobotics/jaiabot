#!/bin/bash

docker run --rm --name jaia-sim-container -d -i -t --env-file sim_env_vars.txt -p "40001:40001" -p "9092:9092" gobysoft/jaiabot-sim-amd64:2.y-test /bin/bash -li /entrypoint.sh
