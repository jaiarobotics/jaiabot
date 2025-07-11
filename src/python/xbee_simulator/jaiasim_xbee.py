#!/usr/bin/python3
import argparse
import logging
from sxbee_server import SimXBeeServer
import socket
import sys
import signal


parser = argparse.ArgumentParser(description='Start simulation server for XBee')
parser.add_argument('-s', dest='socket', default='/tmp/sxbsim.sock', type=str, help='Socket for sending commands to simulator.')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger()
# log.setLevel(args.logging_level)
log.setLevel('DEBUG')

server_address = args.socket

# Start the XBee simulation server if not started already


class JaiaSimXBeeServer:
    def __init__(self):
        self.sxbs = None

    def start(self):
        server_started = False
        try:
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(server_address)
        except socket.error as e:
            log.info(f'Simulation not running, starting simulation server.')
            server_started = False
        else:
            client.close()
            server_started = True
            return

        if not server_started:
            self.sxbs = SimXBeeServer()
            self.sxbs.start()

    def kill(self, *args):
        self.sxbs.stop()


jsxbs = JaiaSimXBeeServer()

def main():
    jsxbs.start()

def kill(*args):
    jsxbs.kill()

def force_kill(*args):
    jsxbs.kill()
    sys.exit()

signal.signal(signal.SIGINT, force_kill)
signal.signal(signal.SIGTERM, kill)

if __name__ == "__main__":
    main()

