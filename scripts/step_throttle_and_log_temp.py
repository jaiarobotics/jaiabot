#!/usr/bin/env python3

import serial
import time
import os
import datetime

time_start = datetime.datetime.now()
print(time_start.replace(microsecond=0).isoformat())

#arduino = serial.Serial('/dev/cu.usbmodem1432401', 19200,timeout = .1)
arduino = serial.Serial('/etc/jaiabot/dev/arduino', 19200,timeout = .1)
answer = input('upload to arduino?')
if answer == 'yes':
    os.system('cd ~/jaiabot/src/arduino/; /etc/jaiabot/arduino_upload.sh step_throttle_and_log_temp/')

def read():
    data = arduino.readline().decode('latin-1')
    data = data.rstrip()
    return data

def write(command):
    command = str(command) + '\n'
    arduino.write(bytes(command, 'utf_8'))

def translate(throttle):
    # 1500 = zero
    # 1100 = full throttle
    return int(1500 + (1500-1100)*(throttle/100))

start_value = int(input('Start at what throttle percentage?'))
# average_time = int(input('How long in seconds to average over?'))
# step_value = int(input('How big is the step?'))
throttle = start_value
microseconds = translate(throttle)
file = open('/home/ubuntu/temperature_logs/' + time_start.replace(microsecond=0).isoformat() + '.csv', "a")
file.write(f'time, temp, throttle\n')
file.close()
print('time, temp, throttle, microseconds')

while True:
    file = open('/home/ubuntu/temperature_logs/' + time_start.replace(microsecond=0).isoformat() + '.csv', "a")
    time_now = datetime.datetime.now()
    time_diff = time_now - time_start
    temp = read()
    print(f'{time_diff} - {temp} - {throttle} - {microseconds}')
    file.write(f'{time_diff},{temp},{throttle}\n')
    write(microseconds)
    file.close()
    time.sleep(1)
    