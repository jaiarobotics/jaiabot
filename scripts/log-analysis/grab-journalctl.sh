#!/usr/bin/env bash

LOG_DIR=/var/log/jaiabot/journals
DATE=$(date '+%Y-%m-%d_%H:%M:%S')

mkdir -p $LOG_DIR

journalctl -b 0 -u 'jaiabot_*' > ${LOG_DIR}/${DATE}.journal
