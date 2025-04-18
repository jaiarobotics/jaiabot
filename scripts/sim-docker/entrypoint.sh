#!/bin/bash
export jaia_fleet_index=$JAIA_SIM_FLEET
export JAIA_REST_API_PRIVATE_KEY=simulation
cd /jaiabot/build/amd64/share/jaiabot/web/server/
source /jaiabot/build/web_dev/python/venv/bin/activate
./app.py &
cd /jaiabot/build/amd64/share/jaiabot/web/rest_api/
./app.py &
cd /jaiabot/config/launch/simulation/
deactivate
./generate_all_launch.sh $JAIA_SIM_BOTS $JAIA_SIM_WARP
./all.launch
