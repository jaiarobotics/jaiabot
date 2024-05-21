#!/bin/bash

set -e

staging_dir="$1"
if [[ -z "${staging_dir}" ]]; then
    echo "Must specify valid bot staging directory as first command line parameter"
    exit 1;
fi

echo "Bot staging dir: ${staging_dir}"

offload_dir="$2"
if [[ -z "${offload_dir}" ]]; then
    echo "Must specify hub offload directory as second command line parameter"
    exit 1;
fi

echo "Hub offload dir: ${offload_dir}"

bot_ip="$3"
if [ -z "${bot_ip}" ]; then
    echo "Must specify bot_ip as third command line parameter"
    exit 1;
fi

echo "Bot ip: ${bot_ip}"

set -u

# Check if the directory exists
if [ ! -d "${offload_dir}" ]; then
  echo "Offload directory does not exist. Creating directory..."
  # Create the directory
  mkdir -p "${offload_dir}"
  echo "Offload directory created successfully."
else
  echo "Offload directory already exists."
fi

# don't specify jaia user for simulation localhost offloads, otherwise do so
if [[ "${bot_ip}" == "127.0.0.1" ]]; then
    userat=""
else
    userat="jaia@"
fi
    
nice -n 10 rsync -aP --info=progress2 --no-inc-recursive --timeout=15 ${userat}${bot_ip}:${staging_dir}/ ${offload_dir}
