#!/bin/bash

PORT=/etc/jaiabot/dev/arduino
MYFQBN=arduino:avr:nano:cpu=atmega328old
sketch=$1

arduino-cli compile -v --upload --libraries libraries -p ${PORT} -b ${MYFQBN} --output-dir $sketch/build $sketch

echo "Done!"
