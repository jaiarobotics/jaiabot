#!/bin/bash

server/jaia_plot_server.py -p 40011 -d ~/jaiaplot-logs/ > jaia_plot_server.log &
SERVER_PID=$!
echo Server pid = ${SERVER_PID}

cd client; npm install; npm run test

kill ${SERVER_PID}
