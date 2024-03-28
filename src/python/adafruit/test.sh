#!/bin/bash

set -e

./analyze.py data/bot3_fleet12_20240225T232808.h5 
python3 acceleration_analyzer.py data/bot3_fleet12_20240225T232808.h5 
