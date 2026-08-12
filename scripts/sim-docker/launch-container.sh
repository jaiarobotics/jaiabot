#!/bin/bash

if [[ -z "$JAIA_SIM_BOTS" ]]; then
    export JAIA_SIM_BOTS=5
fi

if [[ -z "$JAIA_SIM_WARP" ]]; then
    export JAIA_SIM_WARP=3
fi

if [[ -z "$JAIA_SIM_FLEET" ]]; then
    export JAIA_SIM_FLEET=30
fi

docker run --rm --name jaia-sim-container --label jaiabot_build=true -d -i -t -p 40001:40001 -p 9092:9092 -p 40011:40011 --env JAIA_SIM_BOTS=$JAIA_SIM_BOTS --env JAIA_SIM_WARP=$JAIA_SIM_WARP --env JAIA_SIM_FLEET=$JAIA_SIM_FLEET -v ./jdv_data:/var/log/jaiabot/bot_offload jaiauser:jaia-sim-image /bin/bash
