#!/usr/bin/python3
import argparse
import logging
from xbeesim import SimXBee
from xbeetest import SimXBeeGroup
import socket
import os


parser = argparse.ArgumentParser(description='Start simulation server for XBee')
parser.add_argument('-s', dest='socket', default='/tmp/sxbsim.sock', type=str, help='Socket for sending commands to simulator.')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('pressure')
log.setLevel(args.logging_level)

server_address = args.socket

# Remove stale socket file
try:
    os.unlink(server_address)
except FileNotFoundError:
    pass

server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(server_address)
server.listen()

log.info(f'Starting XBee Simulator on {server_address}')

sxbg = SimXBeeGroup()

try:
    while True:
        conn, _ = server.accept()
        with conn:
            data = conn.recv(1024)
            if data:
                try:
                    cmd, name = data.decode().split()
                except:
                    pass
                match cmd:
                    case 'ADD':
                        sxbg.add(name)
except KeyboardInterrupt:
    pass
finally:
    sxbg.close()
    try:
        os.unlink(server_address)
    except FileNotFoundError:
        pass
