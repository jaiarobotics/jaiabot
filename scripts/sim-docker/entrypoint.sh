#!/bin/bash
cd /jaiabot/src/web
./run.sh &
cd /jaiabot/config/launch/simulation/
./generate_all_launch.sh $JAIA_SIM_BOTS $JAIA_SIM_WARP
./all.launch