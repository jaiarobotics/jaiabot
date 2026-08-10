#!/bin/bash

# Thin wrapper around systemd.py for a locally built copy of jaiabot, preserving
# the current $PATH so that systemd.py infers the right bin/share directories.
# (No longer needs an interactive shell: systemd.py used to source preseed.goby
# through 'bash -ic', which is what produced the "Inappropriate ioctl for
# device" noise on deploy.)

sudo -E /bin/bash -c "export PATH=$PATH; $(dirname $0)/systemd.py $*"
