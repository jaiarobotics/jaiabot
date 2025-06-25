#!/usr/bin/env python3

import os
import pty
import tty

class SimXBee():
    def __init__(self, name='pxbee'):
        self.device_name = name
        self.device_path = '/tmp/' + name

    def cleanup(self):
        if os.path.exists(self.device_path):
            os.remove(self.device_path)

    def __enter__(self):
        master_fd, slave_fd = pty.openpty()
        slave_name = os.ttyname(slave_fd)
        self.cleanup()
        os.symlink(slave_name, self.device_path)
        print(f"Fake tty at {self.device_path}")

    def __exit__(self, exc_type, exc_value, traceback):
        self.cleanup()

def main():
    with SimXBee() as xbee:
        pass

if __name__ == "__main__":
    main()