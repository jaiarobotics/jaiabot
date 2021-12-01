#!/usr/bin/env python3

from xbee import *
import functools
import sys

print = functools.partial(print, flush=True)

xbee = XBee('/dev/ttyUSB1')

print('XBee serial number: ', xbee.serial_number())

dest_addr = input('Enter the destination address:')

print('To send a message, type and press enter...')

frame_id = 1

while True:
    data = input().encode('utf8')

    xbee.send_packet(Packet.TransmitRequest(dest_addr, data, frame_id))
    print(xbee.wait_packet())
