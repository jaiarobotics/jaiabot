#!/bin/bash

sudo -E /bin/bash -ic 'export PATH="$1"; shift; ./systemd.py "$@"' systemd-local "$PATH" "$@"
