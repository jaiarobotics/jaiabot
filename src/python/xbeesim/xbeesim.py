#!/usr/bin/env python3

import os
import pty
import tty
import vserial

class SimXBee():
    def __init__(self, name='pxbee'):
        self.name = name
        self.port = '/tmp/' + name
        self.mode = 'transparent'

        self.ser = vserial.VirtualSerialDevice(self.port)

def main():
    with SimXBee() as xbee:
        pass

if __name__ == "__main__":
    main()
