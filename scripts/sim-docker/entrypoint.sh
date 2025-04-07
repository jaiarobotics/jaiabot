#!/bin/bash
export jaia_fleet_index=$JAIA_SIM_FLEET
export JAIA_REST_API_PRIVATE_KEY=simulation
cd /usr/share/jaiabot/web/server
source /usr/share/jaiabot/python/venv/bin/activate
./app.py &
cd /usr/share/jaiabot/web/rest_api/
./app.py localhost &
cd /usr/share/jaiabot/config/launch/simulation
./generate_all_launch.sh $JAIA_SIM_BOTS $JAIA_SIM_WARP
./all.launch 
