#!/bin/bash

if [ -z "$1" ]
then
  echo "Usage: run_bot.sh jaia_n_bots jaia_bot_index"
  exit
fi

export jaia_mode=runtime
export jaia_n_bots=$1
export jaia_bot_index=$2

./bot.launch
