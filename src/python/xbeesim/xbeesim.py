#!/usr/bin/env python3

import os
import pty
import tty
import vserial
import parsers

class SimXBee():
    def __init__(self, name='pxbee'):
        self.name = name
        self.port = '/tmp/' + name
        self.mode = 'transparent'

        self.vsd = vserial.VirtualSerialDevice(
            port=self.port,
            callback=self._read)
        
        self._buffer = bytearray()
        self._data_in = None
        self._data_out = None

        self._command_parser = parsers.CommandParser()

    def start(self):
        self.vsd.open()

    def close(self):
        self.vsd.close()

    def _read(self, data):
        self._data_in = None
        self._data_out = None
        self._buffer.extend(data)
        self._parse()
        self._process()
        self._send()

    def _parse(self):
        if self.mode == 'transparent':
            self._data_in = self._command_parser.parse(self._buffer)
            
    def _process(self):
        if self._data_in == 'OK':
            self._data_out = b'OK'

    def _send(self):
        if self._data_out is not None:
            self.vsd.send(self._data_out)

def main():
    sxb = SimXBee()
    sxb.start()
    try:
        while True:
            pass
    except KeyboardInterrupt:
        pass
    finally:
        sxb.close()


if __name__ == "__main__":
    main()
