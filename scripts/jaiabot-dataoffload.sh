#!/bin/bash

set -e

log_dir="$1"
if [[ -z "${log_dir}" || ! -e "${log_dir}" ]]; then
    echo "Must specify valid log directory as first command line parameter"
    exit 1;
fi

set -u


rsync -aP --timeout=15 --exclude='*.txt*' --exclude="*latest.goby" ${log_dir}/ jaia@hub0:/var/log/jaiabot/bot_offload

echo "Removing old log files..."
# compress debug logs, omitting goby_intervehicle_subscriptions_bot.pb.txt
find ${log_dir} -type f -name '*[0-9].txt' -execdir xz -- {} \;

# remove debug logs older than 7 days
find ${log_dir} -type f -mtime +7 -name '*.txt.xz' -execdir rm -v -f -- {} \;

# remove all logs older than 14 days
find ${log_dir} -type f -mtime +14 -name '*' -execdir rm -v -f -- {} \;   
