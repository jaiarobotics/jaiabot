#!/bin/bash

# Wrapper around systemd.py for a locally built copy of jaiabot. $PATH is
# preserved so that systemd.py infers the right bin/share directories from it.

sudo -E /bin/bash -c "export PATH=$PATH; $(dirname $0)/systemd.py $*"
