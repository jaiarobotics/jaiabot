#!/bin/bash
cd /jaiabot/src/web
./run.sh &
cd /jaiabot/config/launch/simulation/
./generate_all_launch.sh 4 5
./all.launch