#!/bin/bash
mkdir -p .cache
docker run -it --rm -e jaia_fleet_index=23 -v "./.cache/web_dev/:/jaiabot/build/web_dev/" -p "40010:40010" -p "40001:40001" brodiealexander:jaia-sim-ct /bin/bash -li /entrypoint.sh
