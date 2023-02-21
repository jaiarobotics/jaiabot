#!/usr/bin/env python3

import serial
import sys

try:
  device_name = sys.argv[1]
except IndexError:
  device_name = '/etc/jaiabot/dev/xbee'


s = serial.Serial(device_name, baudrate=9600, timeout=3)


def write(data: bytes):
    s.write(data)
    print(f'SENT: {data}')


def read_until(data: bytes, exit_on_failure: bool=False):
    print(f'WAITING FOR: {data}')
    received = s.read_until(data)
    print(f'RECEIVED: {received}')
    if received != data:
        print(f'❌ Error:  modem gave incorrect response.')
        if exit_on_failure:
            exit(1)
    else:
        print('✅')



write(b'+++')
read_until(b'OK\r')

write(b'ATAP=0\r')
read_until(b'OK\r')

write(b'ATCM=FFFFFFFFFFF7FFFF\r')
read_until(b'OK\r')

write(b'ATHP=00\r')
read_until(b'OK\r')

write(b'ATID=0007\r')
read_until(b'OK\r')

print('Done.')

