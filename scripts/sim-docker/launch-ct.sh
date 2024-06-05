#!/bin/bash

#docker run --rm --name jaia-sim-ct -d -i -t --env-file sim_env_vars.txt -e jaia_fleet_index=23 -v "./.cache/web_dev/:/jaiabot/build/web_dev/" -p "40010:40010" -p "40001:40001" -p "30000:30000" jaiauser:jaia-sim-ct /bin/bash -li /entrypoint.sh
#docker run --rm --name jaia-sim-ct -d -i -t --env-file sim_env_vars.txt -e jaia_fleet_index=23 -p "40001:40001" -p "30000:30000" jaiauser:jaia-sim-ct /bin/bash
docker run --rm --name jaia-sim-ct -d -i -t --env-file sim_env_vars.txt -e jaia_fleet_index=23 --network host jaiauser:jaia-sim-ct /bin/bash