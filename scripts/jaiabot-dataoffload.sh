#!/bin/bash

set -e

log_dir="$1"
if [[ -z "${log_dir}" || ! -e "${log_dir}" ]]; then
    echo "Must specify valid log directory as first command line parameter"
    exit 1;
fi

set -u


nice -n 10 rsync -aP --info=progress2 --no-inc-recursive --timeout=15 --exclude='*.txt*' --exclude="*latest.goby" ${log_dir}/ jaia@hub0:/var/log/jaiabot/bot_offload

# Set the path of the directory one level up
parent_dir="${log_dir}/.."

# Where the logs get moved to after rsync to hub
archive_dir="${parent_dir}/archive"

# Check if the directory exists
if [ ! -d "${archive_dir}" ]; then
  echo "Archive directory does not exist. Creating directory..."
  # Create the directory
  mkdir "${archive_dir}"
  echo "Archive directory created successfully."
else
  echo "Archive directory already exists."
fi

# Check if there are files available to move to archive directory
if [ "$(ls -A "${log_dir}")" ]; then
  echo "Moving log files to archive..."
  mv "${log_dir}"/* "${archive_dir}"
  echo "Files moved successfully."
else
  echo "No files available to move."
fi

echo "Compressing debug logs..."
# compress debug logs, omitting goby_intervehicle_subscriptions_bot.pb.txt
find "${archive_dir}" -type f -name '*[0-9].txt' -execdir xz -- {} \;

echo "Removing old log files..."
# remove debug logs older than 7 days
find "${archive_dir}" -type f -mtime +7 -name '*.txt.xz' -execdir rm -v -f -- {} \;
find "${archive_dir}" -type f -mtime +7 -name '*.txt' -execdir rm -v -f -- {} \;

# remove all logs older than 7 days
find "${archive_dir}" -type f -mtime +7 -name '*' -execdir rm -v -f -- {} \;   
