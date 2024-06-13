#!/bin/bash
set -e -u

source /etc/jaiabot/init/include/wt_tools.sh

echo "######################################################"
echo "## CPU stress test                                  ##"
echo "######################################################"

STRESS_SECONDS=10
echo -e "\nStressing all CPUs for $STRESS_SECONDS seconds\n"
sleep 1
(set -x; stress -c `nproc` -t $STRESS_SECONDS)

echo -e "\nPassed: CPU stress test\n"

echo "######################################################"
echo "## Memory stress test                               ##"
echo "######################################################"

STRESS_MBYTES=20
STRESS_REPEAT=1

echo -e "\nStressing $STRESS_MBYTES Mbytes of RAM for $STRESS_REPEAT times\n"
sleep 1

sudo memtester $STRESS_MBYTES $STRESS_REPEAT

echo -e "\nPassed: Memory stress test\n"

echo "######################################################"
echo "## Disk stress test                                 ##"
echo "######################################################"

STRESS_SECONDS=10
echo -e "\nStressing data disk writes for $STRESS_SECONDS seconds\n"
sleep 1

(set -x; cd /var/log; sudo stress -d `nproc` -t $STRESS_SECONDS)

echo -e "\nPassed: data disk stress test\n"
