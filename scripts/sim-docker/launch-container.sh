#!/bin/bash

docker run --rm --name jaia-sim-container -d -i -t -p 40001:40001 -p 9092:9092 --env-file sim_env_vars.txt jaiauser:jaia-sim-image /bin/bash -li "/entrypoint.sh"