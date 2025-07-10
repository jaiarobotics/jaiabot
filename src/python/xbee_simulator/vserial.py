#!/usr/bin/env python3

import os
import pty
from pathlib import Path
from threading import Thread
import fcntl
import logging

class VirtualSerialDevice:
    def __init__(
            self, 
            port: str ='/tmp/vserial',
            callback = None):
        self.__port = Path(port)

        self._logger = logging.getLogger(__name__)

        if callback is not None:
            self._callback = callback
        else:
            self._callback = self._echo
        self._running = True
        self._reader = Thread(target=self._read, daemon=False)

    def __enter__(self):
        self.open()

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def open(self):
        self._create_vserial()
        self._reader.start()
        self._logger.debug(f'[VSD] Attached to virtual serial device at {self.__port}')

    def close(self):
        self._running = False
        self._reader.join(timeout=1)
        self._cleanup_vserial()
        self._logger.debug(f'[VSD] Detached virtual serial device at {self.__port}')

    def send(self, data):
        os.write(self.__master_fd, data)

    @property
    def port(self):
        return self.__port

    def _create_vserial(self):
        self.__master_fd, self.__slave_fd = pty.openpty()
        slave_name = os.ttyname(self.__slave_fd)
        self._cleanup_vserial()
        os.symlink(slave_name, self.__port)

        fl = fcntl.fcntl(self.__master_fd, fcntl.F_GETFL)
        fcntl.fcntl(self.__master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    def _cleanup_vserial(self):
        if os.path.exists(self.__port):
            os.remove(self.__port)

    def _echo(self, data):
        print(data)

    def _read(self):
        while self._running:
            try:
                data = os.read(self.__master_fd, 1024)
                self._logger.debug(f'[VSD] VSD at {self.__port} read: {data}')
                if data:
                    self._callback(data)
            except BlockingIOError:
                continue
            except OSError:
                break

def main():
    vsd = VirtualSerialDevice()
    vsd.open()
    try:
        while True:
            pass
    except KeyboardInterrupt:
        pass
    finally:
        vsd.close()

if __name__ == "__main__":
    main()
