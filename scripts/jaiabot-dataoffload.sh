#!/bin/bash

set -e

log_dir="$1"
if [[ -z "${log_dir}" || ! -e "${log_dir}" ]]; then
    echo "Must specify valid log directory as first command line parameter"
    exit 1;
fi

echo "Bot log dir: ${log_dir}"

hub_ip="$2"
if [ -z "${hub_ip}" ]; then
    hub_ip="hub0"
    echo "No hub ip was set so using hub0 host"
fi

echo "Hub ip: ${hub_ip}"

additional_exclude_files=""
if [ -n "$3" ]; then
  additional_exclude_files="$3"
fi

echo "Extra files to exclude: ${additional_exclude_files}"

hub_id=${jaia_dataoffload_hub_id:-0}

set -u

nice -n 10 rsync -aP --info=progress2 --no-inc-recursive --timeout=15 --exclude=${additional_exclude_files} --exclude='*.txt*' --exclude="*latest.goby" ${log_dir}/ jaia@${hub_ip}:/var/log/jaiabot/bot_offload

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

# Where the sym links get moved to after rsync to hub
sym_dir="${parent_dir}/sym"

# Move sym links to another directory to perserve them
# First create a directory for them 
if [ ! -d "${sym_dir}" ]; then
  echo "Sym directory does not exist. Creating directory..."
  # Create the directory
  mkdir "${sym_dir}"
  echo "Sym directory created successfully."
else
  echo "Sym directory already exists."
fi

# Find all symbolic links in the source directory
find "$log_dir" -type l | while read link; do
    # Use readlink to find the target file of each symbolic link
    target=$(readlink "$link")

    # Move the target file to the destination directory
    mv "$target" "$sym_dir"

    mv "$link" "$sym_dir"
done

# Check if there are files available to move to archive directory
if [ "$(ls -A "${log_dir}")" ]; then
  echo "Moving log files to archive..."
  mv "${log_dir}"/* "${archive_dir}"
  echo "Files moved successfully."
else
  echo "No files available to move."
fi

# Then move the sym links and targets back for logging purposes
if [ "$(ls -A "${sym_dir}")" ]; then
  echo "Moving sym links to log dir..."
  mv "${sym_dir}"/* "${log_dir}"
  echo "Links moved successfully."
else
  echo "No links available to move."
fi

echo "Removing old log files..."
# remove all logs older than 7 days
find "${archive_dir}" -type f -mtime +7 -name '*' -execdir rm -v -f -- {} \;   

echo "Cleanup and remove sym link directory"
rmdir "${sym_dir}"
