#!/bin/bash

BOARD=arduino:avr:leonardo

arduino-cli compile -b ${BOARD}
