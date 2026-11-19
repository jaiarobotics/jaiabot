#!/bin/bash

set -e

log_dir="$1"
if [[ -z "${log_dir}" || ! -e "${log_dir}" ]]; then
    echo "Must specify valid log directory as first command line parameter"
    exit 1;
fi

echo "Bot log dir: ${log_dir}"

staging_dir="$2"
if [[ -z "${staging_dir}" ]]; then
    echo "Must specify valid staging directory as second command line parameter"
    exit 1;
fi

# After repeated failed joins wpa_supplicant locks the fleet Wi-Fi out for up to 5 minutes. Reload
# its configuration so the bot retries now, while the hub waits to start the offload.
if wifi_status=$(wpa_cli -i wlan0 status 2> /dev/null) && ! grep -q '^wpa_state=COMPLETED' <<< "${wifi_status}"; then
    echo "Not connected to the fleet Wi-Fi; asking wpa_supplicant to retry now"
    wpa_cli -i wlan0 reconfigure || true
fi

# Check if the directory exists
if [ ! -d "${staging_dir}" ]; then
  echo "Staging directory does not exist. Creating directory..."
  # Create the directory
  mkdir -p "${staging_dir}"
  echo "Staging directory created successfully."
else
  echo "Staging directory already exists."
fi

additional_exclude_files=""
if [ -n "$3" ]; then
  additional_exclude_files="$3"
fi

echo "Extra files to exclude: ${additional_exclude_files}"

set -u

# Move files matching desired offload settings to staging dir
# storm_outbox holds TaskPackets not yet acknowledged over Iridium, so it stays on the bot
find "$log_dir" -path '*/storm_outbox' -prune -o -type f ! -name '*.txt*' ! -name '*latest.goby' ! -name '*.error' ! -name "${additional_exclude_files}" -exec mv {} "$staging_dir/" \;
