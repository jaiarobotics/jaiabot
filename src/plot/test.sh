#!/bin/bash

server/jaiabot_plot.py -p 40011 -d ~/jaiabotplot-logs/ > jaiabot_plot.log &
SERVER_PID=$!
echo Server pid = ${SERVER_PID}

cd client; npm install; npm run test

kill ${SERVER_PID}
