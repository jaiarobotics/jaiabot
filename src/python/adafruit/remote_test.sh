#!/bin/bash

VENV_DIR=./venv

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment in $VENV_DIR"
    python3 -m venv $VENV_DIR
    $VENV_DIR/bin/pip3 install wheel
    $VENV_DIR/bin/pip3 install -r requirements.txt
else
    echo "Using existing virtual environment in $VENV_DIR"
fi

PYTHON=$VENV_DIR/bin/python3

# Make sure the services aren't running
sudo systemctl stop jaiabot.service

$PYTHON jaiabot_imu.py -t bno085 -i -l DEBUG
