#!/bin/bash
cd /jaiabot/src/web
./run.sh &
cd /jaiabot/config/launch/simulation/
./generate_all_launch.sh 2 1
./all.launch