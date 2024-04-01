#!/bin/bash

n_bots=4
warp=5

script_dir=$(dirname $0)
launchfile=${script_dir}/all.launch
warpfile=${script_dir}/../../gen/common/sim.py

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Usage: generate_all_launch.sh [n_bots, default ${n_bots}] [warp, default ${warp}]"
    exit;
fi

if [ ! -z "$1" ]; then
    n_bots="$1"
    ((n_bots=n_bots+1))
fi
if [ ! -z "$2" ]; then
    warp="$2"
fi

launchdelay=100

cat <<EOF > ${launchfile}
#!/usr/bin/env -S goby_launch -s -P -k30 -pall -d500 -L

[env=jaia_mode=simulation,env=jaia_warp=${warp}] goby_launch -P -d${launchdelay} hub.launch
EOF

for i in `seq 1 $((n_bots-1))`; do
    echo "[env=jaia_n_bots=${n_bots},env=jaia_bot_index=${i},env=jaia_mode=simulation,env=jaia_warp=${warp},env=jaia_electronics_stack=2,env=jaia_bot_type=HYDRO] goby_launch -P -d${launchdelay} bot.launch" >> ${launchfile}
done

echo "Setting excutable permissions for all.launch"

chmod 755 ${launchfile}

echo "Generated all.launch with $((n_bots-1)) bots @ warp ${warp}x"
