#!/bin/bash

# below are commands provided by Brodie
#mkdir -p .cache
#docker run -it --rm -e jaia_fleet_index=23 -v "./.cache/web_dev/:/jaiabot/build/web_dev/" -p "40010:40010" -p "40001:40001" -p "30000:30000" jaiauser:jaia-sim-ct /bin/bash -li /entrypoint.sh

# below are commands I used to launch and test the container while debugging, not sure why the -v option was used above(local persistent volume)
# -v probably used to avoid rebuilding web from scratch every time, takes forever! but it does not seem to make a big difference
# Probably faster to launch it without --rm and -v and then just stop and start it as needed -- Check with Matt

#docker run --name jaia-sim-container-test2 -d -i -t -e jaia_fleet_index=23 -p "40010:40010" -p "40001:40001" -p "30000:30000" jaiauser:jaia-sim-ct-test2 /bin/bash
#docker exec -it jaia-sim-container-test2 bash -li /entrypoint.sh

#working code
mkdir -p .cache
docker run --rm --name jaia-sim-container-test2 -d -i -t -e jaia_fleet_index=23 -v "./.cache/web_dev/:/jaiabot/build/web_dev/" -p "40010:40010" -p "40001:40001" -p "30000:30000" jaiauser:jaia-sim-ct-test2 /bin/bash -li /entrypoint.sh
