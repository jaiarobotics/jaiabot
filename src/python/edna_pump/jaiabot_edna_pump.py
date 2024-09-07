#!/usr/bin/env python3
from time import sleep
import argparse
import socket
import traceback
import logging
from edna_pump import *
from math import *
from threading import Thread
from dataclasses import dataclass
from jaiabot.messages.edna_pump_pb2 import eDNAData, eDNACommand
from google.protobuf import text_format

parser = argparse.ArgumentParser(description='eDNA Pump data, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish eDNA Pump data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING (default), INFO, DEBUG)')
args = parser.parse_args()

logging.warning(args)

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_edna_pump')
log.setLevel(args.logging_level)

def do_port_loop(edna_pump: eDNAPump):
    # Create socket
    port = args.port
    if port is None:
        log.error(f'Must specify port number')
        exit(1)

    log.info(f'Socket mode: listening on port {port}.')

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', port))

    while True:

        data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes
        try:
            # Deserialize the message
            command = eDNACommands()
            command.ParseFromString(data)
            log.debug(f'Received command:\n{command}')

            # Execute the command
            if command.type == eDNACommands.CMD_START:
                edna_pump.startPump()
            elif command.type == eDNACommands.CMD_STOP:
                edna_pump.stopPump()

        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    edna_pump = eDNAPump()

    # Start the thread that responds to EchoCommands over the port
    portThread = Thread(target=do_port_loop, name='portThread', daemon=True, args=[edna_pump])
    portThread.start()

    # Main loop
    portThread.join() 