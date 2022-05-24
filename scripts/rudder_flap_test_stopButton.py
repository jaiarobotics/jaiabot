#!/usr/bin/env python3

import serial
import time
import os

#arduino = serial.Serial('/dev/cu.usbserial-143230', 19200,timeout = .1)
arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh rudder_flap_test/')

def rd():
    data = arduino.readline()
    return data

def write(command):
    command = str(command)
    command = command+'\n'
    arduino.write(bytes(command, 'utf_8'))

while True:
    write(input("type capital S when you want to program to stop "))
