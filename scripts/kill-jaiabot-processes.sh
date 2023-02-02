#!/usr/bin/env bash

declare -a ProcessArray=(
    gobyd
    goby_launch
    goby_liaison
    goby_liaison_jaiabot
    goby_moos_gateway
    goby_opencpn_interface
    jaiabot_bluerobotics_pressure_sensor_driver
    jaiabot_engineering
    jaiabot_fusion
    jaiabot_health
    jaiabot_hub_manager
    jaiabot_metadata
    jaiabot_pid_control
    jaiabot_simulator
    jaiabot_web_portal
    socat
    bluerobotics-pressure-sensor-driver
    jaiabot_mission_manager
    goby_gps
    goby_logger
    goby_coroner
    moos_gen.sh
    MOOSDB
    pHelmIvP
    pMarineViewer
    uProcessWatch
    pNodeReporter
    uSimMarine
    pMarinePID
    app.py
    gpsd
    )

for process in ${ProcessArray[@]}; do
    if sudo killall -q $process; then
        echo "found and killed: $process"
    else
        echo "       not found: $process"
    fi
done
