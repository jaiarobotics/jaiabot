#!/bin/bash

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <remote-host>"
  exit 1
fi

REMOTE=$1

if [[ $2 == "clean" ]]; then
    echo "Cleaning remote host"
    ssh $REMOTE "rm -rf ~/python/*"
fi

rsync -zaP -r --exclude="venv/" --exclude="*.pyc" --exclude="*.egg-info" ../ $REMOTE:python/

ssh $REMOTE "cd python/adafruit; ./remote_test.sh"
