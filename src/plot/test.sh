#!/bin/bash

trap kill_server INT

function kill_server() {
    kill ${SERVER_PID}
}

server/jaiabot_data_vision.py -p 40011 -d /var/log/jaiabot/bot_offload/ &> jaiabot_data_vision.log &
SERVER_PID=$!
echo Server pid = ${SERVER_PID}

cd client; npm install; npm run test
