#!/usr/bin/env python3

import serial
import time
import os


arduino = serial.Serial('/dev/cu.usbmodem1432401', 19200,timeout = .1)
#arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)

temp = open("temp_recornd.csv", "w")
temp.write("")
temp.close()

def rd():
    data = arduino.readline()
    return data

def write(command):
    command = str(command)
    command = str(command + "\n")
    arduino.write(bytes(command, 'utf_8'))

records = []

x = True
while x == True:
    command = int(input("number between -100 and 100"))
    if command <= 100 or command >= -100:
        write(command)
        x = False
    else:
        print("try again")
while True:
    temp = open("temp_recornd.csv", "a")
    value = rd()
    value = str(value)
    value = value.replace("b","")
    value = value.replace("'","")
    value = value.replace("\\","")
    value = value.replace("r","")
    value = value.replace("n","")
    value = str(value + ",")
    print(value)
    temp.write(value)
    temp.close()
    time.sleep(2)
    
