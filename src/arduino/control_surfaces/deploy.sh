#!/bin/bash
arduino-cli compile -b adafruit:avr:feather32u4
arduino-cli upload -v -p /dev/ttyACM0 -b adafruit:avr:feather32u4
