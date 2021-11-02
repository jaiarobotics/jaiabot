#!/usr/bin/env python3

import serial
import sys

try:
  device_name = sys.argv[1]
except IndexError:
  device_name = '/dev/ttyUSB0'

s = serial.Serial(device_name, baudrate=9600)

s.write(b'+++')
s.read_until(b'OK\r')

s.write(b'ATAP=0\r')
s.read_until(b'OK\r')

print('Modem reset to transparent mode.')
