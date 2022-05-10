#!/bin/bash

BOT_HOSTNAME=$1

if [[ -z "$1" ]]
then
    echo "Usage: get_logs.sh hostname1 [hostname2 ...]"
    exit 1
fi

set -e

mkdir -p ${HOME}/jaia-logs

for ((i=1; i<=$#; i++))
do
    BOT_HOSTNAME="${!i}"
    echo "🟢 Downloading logs from: ${BOT_HOSTNAME}"
    set -x
    rsync -zaP ubuntu@${BOT_HOSTNAME}:jaia-logs/ ${HOME}/jaia-logs/${BOT_HOSTNAME}
    ssh ubuntu@${BOT_HOSTNAME} 'rm -rf ${HOME}/jaia-logs/*'
    set +x
done

echo "✅ Successfully downloaded all logs!"
