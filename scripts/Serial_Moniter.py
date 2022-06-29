#!/usr/bin/env python3

import serial
import time

arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

#reads from the arduino serial moniter
def rd():
    data = arduino.readline()
    data = data.decode()
    print(data)

while True:
    rd()