#!/usr/bin/env python3

#talks to the serial moniter
import serial

#this makes serial lib work
import time

arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

#reads from the arduino serial moniter
def rd():
    data = arduino.readline()
    print(data)

while True:
    rd()