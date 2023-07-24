#!/usr/bin/env python3

from gpsdclient import GPSDClient
from gpsdsimulator import GPSDSimulator, WaveComponent
from analyzer import Analyzer, GPSSample
from udp_listener import UDPListener
from time import sleep
import argparse
import logging
from jaiabot.messages.wave_pb2 import WaveCommand, WaveData
import socket

# Parse arguments
parser = argparse.ArgumentParser(prog=__file__, description='Calculates wave statistics from gpsd TPV data')
parser.add_argument('-s', dest='simulator', action='store_true', help='Use a simulated gpsd')
parser.add_argument('-g', dest='gpsd_host', default='localhost:2947', help='Hostname and port as `hostname:port`')      # option that takes a value
parser.add_argument('-l', dest='log_level', default='INFO', help='Log level')
parser.add_argument('-p', dest='listen_port', default=53293, help='Port to listen for requests')
args = parser.parse_args()


logging.basicConfig(level=logging.getLevelName(args.log_level))

# Get the appropriate gsdClient object
if args.simulator:
    logging.info('Using simulated gpsd')
    gpsdClient = GPSDSimulator(wave_components=[WaveComponent(frequency=1.3, amplitude=7)])
else:
    if args.gpsd_host is None:
        logging.error('No hostname:port specified!')
        exit(1)
    else:
        logging.info(f'Connected to gpsd at "{args.gpsd_host}"')
    
    components = args.gpsd_host.split(':')

    hostname = components[0]
    port = int(components[1])

    gpsdClient = GPSDClient(hostname, port)




# Get the analyzer and start the thread
analyzer = Analyzer(gpsdClient)

# Listen on the port
udpListener = UDPListener(analyzer=analyzer, listen_port=args.listen_port)


sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('127.0.0.1', 0))

while True:
    print('[S] to start sampling, [D] to stop sampling, [Enter] to take measurement')
    inputString = input().lower()

    commandMap = {
        's': WaveCommand.START_SAMPLING,
        'd': WaveCommand.STOP_SAMPLING
    }

    command = WaveCommand()
    command.type = commandMap.get(inputString, WaveCommand.TAKE_READING)

    sock.sendto(command.SerializeToString(), ('localhost', args.listen_port))

    if command.type == WaveCommand.TAKE_READING:
        data = sock.recv(1024)
        waveData = WaveData()
        waveData.ParseFromString(data)

        logging.info(f'Significant wave height: {waveData.significant_wave_height}')

