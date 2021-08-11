#!/bin/bash
arduino-cli compile -b adafruit:avr:feather32u4
arduino-cli upload -p /dev/ttyACM0 -b adafruit:avr:feather32u4
