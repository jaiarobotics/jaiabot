#!/bin/bash
cd /jaiabot/src/web
./run.sh &
cd /jaiabot/config/launch/simulation/
./generate_all_launch.sh $NUM_BOTS $WARP_SPEED
./all.launch