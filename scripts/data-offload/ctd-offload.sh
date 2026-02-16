#!/bin/bash

set -e

bot_id=0
bot_ip="127.0.0.1"

while [[ $# -gt 0 ]]; do
    if [[ "$1" == "-bot_id" ]]; then
        bot_id="$2"
        shift 2
    elif [[ "$1" == "-bot_ip" ]]; then
        bot_ip="$2"
        shift 2
    else
        echo "Unknown argument: $1" >&2
        shift
    fi
done

if [[ "$bot_id" -eq 0 ]]; then
    echo "No Bot ID provided"
    exit 1;
fi

destination_dir="/var/log/jaiabot/bot_offload/ctd/$bot_id/"
ctd_dir="/var/log/jaiabot/bot/${bot_id}/ctd/"

if [[ ! -d "${destination_dir}" ]]; then
  mkdir -p "${destination_dir}"
fi

if [[ "${bot_ip}" == "127.0.0.1" ]]; then
    userat=""
    nice -n 10 rsync -azh --info=progress2 --timeout=15  --remove-source-files "${ctd_dir}" "${destination_dir}"

else
    userat="jaia@"
    nice -n 10 rsync -azh --info=progress2 --timeout=15  --remove-source-files "${userat}${bot_ip}:${ctd_dir}" "${destination_dir}"
fi
