#!/bin/bash

BOT=jbot0

rsync -a ../salinity/ ${BOT}:salinity

ssh ${BOT} "cd salinity; ./calibrate_atlas_oem.py"
