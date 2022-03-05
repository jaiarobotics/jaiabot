#!/bin/bash

MYFQBN=arduino:avr:nano:cpu=atmega328old
sketch=$1

arduino-cli compile -v --fqbn $MYFQBN --output-dir $sketch/build $sketch

sudo "/home/ubuntu/.arduino15/packages/arduino/tools/avrdude/6.3.0-arduino17/bin/avrdude" "-C/home/ubuntu/.arduino15/packages/arduino/tools/avrdude/6.3.0-arduino17/etc/avrdude.conf" -C./avrdude.conf -v -patmega328p -cpi_1 -b57600 "-Uflash:w:${sketch}/build/${sketch}.ino.with_bootloader.hex:i"

echo "Done!"
