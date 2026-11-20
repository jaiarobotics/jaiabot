#!/bin/bash
# Makes a hub in the simulator lose its active missions: stops its jaiabot_hub_manager,
# then starts it again with the environment and working directory it had.
#
# Usage: sim-forget-active-missions.sh <hub_id>
# Run it where the simulator runs; for the Docker sim, pipe it in:
#   docker exec -i jaia-sim bash -s 2 < sim-forget-active-missions.sh

set -e -u -o pipefail

hub_id="$1"

pid=
# the kernel keeps only the first 15 characters of a process name
for candidate in $(pgrep -x jaiabot_hub_man); do
    if tr '\0' '\n' < "/proc/${candidate}/environ" | grep -qx "jaia_hub_id=${hub_id}"; then
        pid="${candidate}"
        break
    fi
done
if [ -z "${pid}" ]; then
    echo "no jaiabot_hub_manager is running for hub ${hub_id}" >&2
    exit 1
fi

mapfile -d '' environment < "/proc/${pid}/environ"
directory=$(readlink "/proc/${pid}/cwd")

kill "${pid}"
for _ in $(seq 1 100); do
    kill -0 "${pid}" 2> /dev/null || break
    sleep 0.1
done
if kill -0 "${pid}" 2> /dev/null; then
    echo "hub ${hub_id}'s jaiabot_hub_manager (${pid}) did not stop" >&2
    exit 1
fi

cd "${directory}"
# its own session, so it outlives a docker exec that ends with this script
env -i "${environment[@]}" setsid bash -c \
    'exec jaiabot_hub_manager <(../../gen/hub.py jaiabot_hub_manager)' \
    > "/tmp/jaiabot_hub_manager_hub${hub_id}_restarted.log" 2>&1 < /dev/null &
echo "restarted hub ${hub_id}'s jaiabot_hub_manager (pid $!)"
