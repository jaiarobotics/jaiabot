#!/usr/bin/env python3

import serial

s = serial.Serial('/dev/ttyUSB0', baudrate=9600)

s.write(b'+++')
s.read_until(b'OK\r')

s.write(b'ATAP=0\r')
s.read_until(b'OK\r')

print('Modem reset to transparent mode.')
