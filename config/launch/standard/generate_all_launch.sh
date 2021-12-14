#!/bin/bash

n_auvs=4
warp=5

script_dir=$(dirname $0)
launchfile=${script_dir}/all.launch
warpfile=${script_dir}/../../gen/common/sim.py

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Usage: generate_all_launch.sh [n_auvs, default ${n_auvs}] [warp, default ${warp}]"
    exit;
fi

if [ ! -z "$1" ]; then
    n_auvs="$1"
fi
if [ ! -z "$2" ]; then
    warp="$2"
fi

launchdelay=100

cat <<EOF > ${launchfile}
#!/usr/bin/env -S goby_launch -s -P -k30 -ptrail -d500 -L

goby_launch -P -d${launchdelay} topside.launch
EOF

for i in `seq 0 $((n_auvs-1))`; do
    echo "[env=jaia_auv_index=${i}] goby_launch -P -d${launchdelay} auv.launch" >> ${launchfile}
done

echo "warp=${warp}" > ${warpfile}

echo "Generated all.launch with ${n_auvs} AUVS. Set warp to ${warp}"
