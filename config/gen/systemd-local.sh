#!/bin/bash

sudo -E /bin/bash -ic "export PATH=/home/jaia/jaiabot/build/arm64/bin:$PATH; ./systemd.py $*"
