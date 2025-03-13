#!/bin/bash
set -e

#############################
## Install Camera packages ##
#############################
apt-get -y update && apt-get -y install libcamera-apps libcamera-dev python3-libcamera

