#!/usr/bin/env python3

import serial
import sys

try:
  device_name = sys.argv[1]
except IndexError:
  device_name = '/dev/xbee'

s = serial.Serial(device_name, baudrate=9600)

s.write(b'+++')
s.read_until(b'OK\r')

s.write(b'ATAP=0\r')
s.read_until(b'OK\r')

s.write(b'ATCM=FFFFFFFFFFF7FFFF\r')
s.read_until(b'OK\r')

s.write(b'ATHP=00\r')
s.read_until(b'OK\r')

s.write(b'ATID=0007\r')
s.read_until(b'OK\r')

print('Modem reset to transparent mode.')
