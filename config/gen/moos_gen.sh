#!/bin/bash

# Generates temporary MOOS file and then deletes it after exiting
# This is required by MOOS applications can't handle process substitution: <(command)

moos_tmpfile=/tmp/jaiabot_${jaia_bot_index}.moos
moos_sim_tmpfile=/tmp/jaiabot_sim_${jaia_bot_index}.moos
bhv_tmpfile=/tmp/jaiabot_${jaia_bot_index}.bhv

echo -e "Generating $moos_tmpfile $moos_sim_tmpfile $bhv_tmpfile"
script_dir=$(dirname $0)
python3 ${script_dir}/bot.py moos > $moos_tmpfile
python3 ${script_dir}/bot.py moos_sim > $moos_sim_tmpfile
python3 ${script_dir}/bot.py bhv > $bhv_tmpfile
trap "echo -e \"Deleting $moos_tmpfile $moos_sim_tmpfile $bhv_tmpfile\"; rm -f $moos_tmpfile $moos_sim_tmpfile $bhv_tmpfile" EXIT

while true; do sleep 1; done
