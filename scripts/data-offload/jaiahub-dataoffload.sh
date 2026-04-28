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

# Optional: when provided, only files matching this pattern are transferred (e.g. "*.unb")
file_filter="${4:-}"

# Optional: when non-empty, delete source files after successful transfer
remove_source_files="${5:-}"

# Check if the directory exists
if [ ! -d "${offload_dir}" ]; then
  echo "Offload directory does not exist. Creating directory..."
  # Create the directory
  mkdir -p "${offload_dir}"
  echo "Offload directory created successfully."
else
  echo "Offload directory already exists."
fi

# Build optional rsync filter args
rsync_filter=()
if [[ -n "${file_filter}" ]]; then
    rsync_filter=("--include=${file_filter}" "--exclude=*")
fi

# Build optional remove-source-files flag
remove_flag=()
if [[ -n "${remove_source_files}" ]]; then
    remove_flag=("--remove-source-files")
fi

# Common rsync options (filter and remove flags expand to nothing when not set)
rsync_opts=(-aP --info=progress2 --no-inc-recursive --timeout=15
    ${remove_flag[@]+"${remove_flag[@]}"} ${rsync_filter[@]+"${rsync_filter[@]}"})

# don't specify jaia user for simulation localhost offloads, otherwise do so
if [[ "${bot_ip}" == "127.0.0.1" ]]; then
    nice -n 10 rsync "${rsync_opts[@]}" "${staging_dir}/" "${offload_dir}"
else
    nice -n 10 rsync "${rsync_opts[@]}" "jaia@${bot_ip}:${staging_dir}/" "${offload_dir}"
fi
