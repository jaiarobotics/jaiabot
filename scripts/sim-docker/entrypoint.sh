#!/bin/bash
export jaia_fleet_id=$JAIA_SIM_FLEET
export jaia_iridium_sim_args=$JAIA_SIM_IRIDIUM_ARGS
source /usr/share/jaiabot/python/venv/bin/activate
cd /usr/share/jaiabot/web/server
./app.py &
# The REST API is started by hub.launch, which all.launch runs below
cd /usr/share/jaiabot/web/jdv/server
python3 jaiabot_data_vision.py -d /var/log/jaiabot/bot_offload -a /usr/share/jaiabot/web/jdv/client/dist/ -p 40011 &
cd /usr/share/jaiabot/config/launch/simulation
./generate_all_launch.sh $JAIA_SIM_BOTS $JAIA_SIM_WARP ${JAIA_SIM_COMMS:-w}
./all.launch 