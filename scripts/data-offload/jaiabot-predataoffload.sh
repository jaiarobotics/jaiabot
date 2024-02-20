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
rsync -aP --exclude=${additional_exclude_files} --exclude='*.txt*' --exclude="*latest.goby"  --remove-source-files ${log_dir}/ ${staging_dir}/
