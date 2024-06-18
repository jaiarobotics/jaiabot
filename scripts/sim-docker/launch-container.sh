#!/bin/bash

docker run --rm --name jaia-sim-container -d -i -t --env-file sim_env_vars.txt -p "40001:40001" jaiauser:jaia-sim-image /bin/bash -li /entrypoint.sh
