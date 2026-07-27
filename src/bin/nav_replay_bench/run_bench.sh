#!/bin/bash
# Runs gobyd + jaiabot_state_estimator + jaiabot_nav_replay_bench on an isolated platform,
# replaying a log through the real application path.
set -u
WARP=${WARP:-10}
SKIP=${SKIP:-0}
DUR=${DUR:-600}
PLAT=benchp
export LD_LIBRARY_PATH=/opt/mynav

SIM="simulation { time { use_sim_time: true warp_factor: ${WARP} } }"
IPC="interprocess { platform: \"${PLAT}\" }"

cat > /bench/gobyd.cfg <<EOF
app { name: "gobyd" glog_config { tty_verbosity: WARN } ${SIM} }
${IPC}
EOF

cat > /bench/est.cfg <<EOF
app { name: "jaiabot_state_estimator" glog_config { tty_verbosity: WARN } ${SIM} }
${IPC}
publish_to_node_status: false
EOF

cat > /bench/bench.cfg <<EOF
app { name: "jaiabot_nav_replay_bench" glog_config { tty_verbosity: VERBOSE } ${SIM} }
${IPC}
log: "/bench/log.csv"
out: "/bench/bench_nav.csv"
skip: ${SKIP}
duration: ${DUR}
quit_after: 3
EOF

rm -f /bench/bench_nav.csv /tmp/goby_${PLAT}.manager
pkill -f "gobyd /bench" 2>/dev/null; pkill -f jaiabot_state_estimator 2>/dev/null
sleep 1

gobyd /bench/gobyd.cfg &                       GOBYD=$!
sleep 2
jaiabot_state_estimator /bench/est.cfg &        EST=$!
sleep 2
jaiabot_nav_replay_bench /bench/bench.cfg;      RC=$?

kill $EST $GOBYD 2>/dev/null; wait 2>/dev/null
echo "bench exit=${RC}"
wc -l /bench/bench_nav.csv 2>/dev/null || echo "NO OUTPUT"
