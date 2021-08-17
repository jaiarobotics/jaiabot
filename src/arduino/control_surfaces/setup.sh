#!/bin/bash

mkdir -p ~/Arduino/libraries
cd ~/Arduino/libraries
ln -s ~/jaiabot/src/arduino/libraries/RadioHead-1.117 .
ln -s ~/jaiabot/src/arduino/libraries/nanopb-0.4.1 .

arduino-cli config init --additional-urls  https://adafruit.github.io/arduino-board-index/package_adafruit_index.json
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli core install adafruit:avr
arduino-cli board list

