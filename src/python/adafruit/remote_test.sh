#!/bin/bash

VENV_DIR=${HOME}/venv

python3 -m venv $VENV_DIR

pushd ../
$VENV_DIR/bin/pip3 install wheel
$VENV_DIR/bin/pip3 install -r requirements.txt
popd

PYTHON=$VENV_DIR/bin/python3

$PYTHON jaiabot_imu.py -t bno085 -i
