#!/bin/bash

timekeeper_dir="/etc/jaiabot/timekeeper"

# Check if the directory exists
if [ ! -d "${timekeeper_dir}" ]; then
  echo "timekeeper directory does not exist. Creating directory..."
  # Create the directory
  mkdir "${timekeeper_dir}"
  echo "timekeeper directory created successfully."
else
  echo "timekeeper directory already exists."
fi

timekeeper_file="/etc/jaiabot/timekeeper/time.txt"

# Check if the file exists
if [ -e "${timekeeper_file}" ]; then
    echo "timekeeper file exists!"
    read -r time < $timekeeper_file && sudo date -s "$time"
else
    echo "timekeeper file does not exist."
fi

while true; do

    # Check NTP synchronization status
    ntp_status=$(timedatectl show --property=NTPSynchronized --value)

    if [[ $ntp_status == "yes" ]]; then
        sudo date > $timekeeper_file
        echo "Setting updated date to $timekeeper_file"
    else
        echo "NTP synchronization not active. Cannot set date to file."
    fi

    sleep 60 # wait for 60 seconds before checking again

done


