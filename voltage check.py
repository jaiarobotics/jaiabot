#!/usr/bin/env python3
import serial
import time

arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

#reads from the arduino serial moniter
def rd():
    data = arduino.readline()
    data = data.decode()
    return data

#writes to the serail moniter and sends the command - \n is the newline command
def write(command):
    command = str(command)
    command = command+'\n'
    arduino.write(bytes(command, 'utf_8'))

while True:
    rd()