#!/bin/bash

docker run --rm --name jaia-sim-ct -d -i -t --env-file sim_env_vars.txt --network host jaiauser:jaia-sim-ct /bin/bash -li /entrypoint.sh
