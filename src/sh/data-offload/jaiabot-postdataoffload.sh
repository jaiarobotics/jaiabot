#!/bin/bash

set -e

log_dir="$1"
if [[ -z "${log_dir}" || ! -e "${log_dir}" ]]; then
    echo "Must specify valid log directory as first command line parameter"
    exit 1;
fi

echo "Bot log dir: ${log_dir}"


staging_dir="$2"
if [[ -z "${staging_dir}" || ! -e "${staging_dir}" ]]; then
    echo "Must specify valid staging directory as second command line parameter"
    exit 1;
fi

echo "Bot staging dir: ${staging_dir}"

archive_dir="$3"
if [[ -z "${archive_dir}" ]]; then
    echo "Must specify valid archive directory as third command line parameter"
    exit 1;
fi

echo "Bot archive dir: ${archive_dir}"


# Check if the directory exists
if [ ! -d "${archive_dir}" ]; then
  echo "Archive directory does not exist. Creating directory..."
  # Create the directory
  mkdir -p "${archive_dir}"
  echo "Archive directory created successfully."
else
  echo "Archive directory already exists."
fi

if [ "$(ls -A "${staging_dir}")" ]; then
  echo "Moving staged log files to archive..."
  mv "${staging_dir}"/* "${archive_dir}"/
  echo "Files moved successfully."
else
  echo "No files available to move."
fi

echo "Removing old log files..."
# remove all logs older than 7 days from both archive (offloaded logs) and log dir (debug logs)
find "${archive_dir}" -type f -mtime +7 -name '*' -execdir rm -v -f -- {} \;   
find "${log_dir}" -type f -mtime +7 -name '*' -execdir rm -v -f -- {} \;   
