#!/bin/bash

n_bots=4
warp=5
comms_mode="w"

script_dir=$(dirname $0)
preseedfile=${script_dir}/preseed.goby
launchfile=${script_dir}/all.launch
warpfile=${script_dir}/../../gen/common/sim.py

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Usage: generate_all_launch.sh [n_bots, default ${n_bots}] [warp, default ${warp}] [(x)bee or (w)ifi comms, default ${comms_mode}]"
    exit;
fi

if [ ! -z "$1" ]; then
    n_bots="$1"
    ((n_bots=n_bots+1))
fi
if [ ! -z "$2" ]; then
    warp="$2"
fi
if [ ! -z "$3" ]; then
    comms_mode="$3"
fi

if [[ "$comms_mode" == *x* ]]; then
    jaia_comms_mode="xbee"
fi
if [[ "$comms_mode" == *w* ]]; then
    jaia_comms_mode="wifi"
fi
if [[ "$comms_mode" == *w* && "$comms_mode" == *x* ]]; then
    jaia_comms_mode="xbee,wifi"
fi

${script_dir}/../../../rootfs/customization/includes.chroot/etc/jaiabot/init/jaia-create-ansible-inventory.sh -b $(seq -s , 1 ${n_bots}) -h 1 -f 0 > /etc/jaiabot/inventory.yml

launchdelay=100

cat <<EOF > ${preseedfile}
export jaia_mode=simulation
export jaia_comms_mode=${jaia_comms_mode}
source "$(dirname ${BASH_SOURCE:-${(%):-%x}})/../../preseed.goby"
EOF


cat <<EOF > ${launchfile}
#!/usr/bin/env -S goby_launch -s -P -k30 -pall -d500 -L

./world_sim.launch

[env=jaia_warp=${warp}] goby_launch -P -d${launchdelay} hub.launch
EOF

for i in `seq 1 $((n_bots-1))`; do
    echo "[env=jaia_n_bots=${n_bots},env=jaia_bot_index=${i},env=jaia_warp=${warp},env=jaia_electronics_stack=2,env=jaia_bot_type=HYDRO] goby_launch -P -d${launchdelay} bot.launch" >> ${launchfile}
done

echo "Setting excutable permissions for all.launch"

chmod 755 ${launchfile}

echo "Generated all.launch with $((n_bots-1)) bots @ warp ${warp}x using comms: $jaia_comms_mode"
