#!/bin/bash

sudo -E /bin/bash -ic "export PATH=/home/jaia/jaiabot/build/arm64/bin:/home/jaia/jaiabot/build/amd64-vbox/bin:$PATH; ./systemd.py $*"
