#!/bin/bash

BOARD=arduino:avr:leonardo

arduino-cli compile --libraries ../libraries -b ${BOARD}
