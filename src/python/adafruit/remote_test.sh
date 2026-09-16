#!/bin/bash

VENV_DIR=./venv

# Make sure the services aren't running
sudo systemctl stop jaiabot.service

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment in $VENV_DIR"
    python3 -m venv $VENV_DIR
    $VENV_DIR/bin/pip3 install wheel
    $VENV_DIR/bin/pip3 install -r requirements.txt
else
    echo "Using existing virtual environment in $VENV_DIR"
    $VENV_DIR/bin/pip3 install -U ../pyjaiaprotobuf
fi

PYTHON=$VENV_DIR/bin/python3

# the menu-driven tester is an application of its own now, and talks to the driver
# over the interprocess layer rather than running the IMU itself
$PYTHON jaiabot_imu_test.py -C "$JAIA_GEN jaiabot_imu_test"
