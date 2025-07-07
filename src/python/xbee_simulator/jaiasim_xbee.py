#!/usr/bin/python3
import argparse
import logging
from sxbee_server import SimXBeeServer
import socket
import os


parser = argparse.ArgumentParser(description='Start simulation server for XBee')
parser.add_argument('-s', dest='socket', default='/tmp/sxbsim.sock', type=str, help='Socket for sending commands to simulator.')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger()
log.setLevel(args.logging_level)

server_address = args.socket

# Start the XBee simulation server if not started already

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

if not server_started:
    pass # Start server as separate process
