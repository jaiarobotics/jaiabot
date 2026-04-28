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

destination_dir="/var/log/jaiabot/bot_offload/ctd/${bot_id}"
ctd_dir="/var/log/jaiabot/bot/${bot_id}/ctd"
archive_dir="/var/log/jaiabot/archive"

# Use the shared hub data offload script, restricting the transfer to *.unb files only
jaiahub-dataoffload.sh "${ctd_dir}" "${destination_dir}" "${bot_ip}" "*.unb"

# Archive the offloaded CTD files on the bot
if [[ "${bot_ip}" == "127.0.0.1" ]]; then
    mkdir -p "${archive_dir}"
    find "${ctd_dir}" -maxdepth 1 -type f -exec mv {} "${archive_dir}/" \;
else
    # shellcheck disable=SC2029  # client-side expansion of bot paths is intentional
    ssh "jaia@${bot_ip}" \
        "mkdir -p ${archive_dir} && find ${ctd_dir} -maxdepth 1 -type f -exec mv {} ${archive_dir}/ \;"
fi
