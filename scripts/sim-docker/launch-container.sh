#!/bin/bash

docker run --rm --name jaia-sim-container -d -i -t --env-file sim_env_vars.txt --network host jaiauser:jaia-sim-image /bin/bash -li /entrypoint.sh
