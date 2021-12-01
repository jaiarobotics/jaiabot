#!/usr/bin/env python3

from xbee import *
import functools

print = functools.partial(print, flush=True)

xbee = XBee()

print('XBee serial number: ', xbee.serial_number())

while True:
    p = xbee.wait_packet()

    print('received packet: ', p)

