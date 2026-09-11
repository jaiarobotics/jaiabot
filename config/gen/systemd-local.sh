#!/bin/bash

# Wrapper around systemd.py for a locally built copy of jaiabot. $PATH is
# preserved so that systemd.py infers the right bin/share directories from it.

sudo -E /bin/bash -c 'export PATH="$1"; script_dir="$2"; shift 2; "${script_dir}/systemd.py" "$@"' \
     systemd-local "$PATH" "$(dirname "$0")" "$@"
