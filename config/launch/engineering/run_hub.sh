#!/bin/bash

if [ -z "$1" ]
then
  echo "Usage: run_hub.sh jaia_n_bots"
  exit
fi

export jaia_mode=runtime
export jaia_n_bots=$1

./hub.launch
