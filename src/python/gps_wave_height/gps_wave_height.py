#!/usr/bin/env python3

from gpsdclient import GPSDClient
from gpsdsimulator import GPSDSimulator, WaveComponent
from analyzer import Analyzer, GPSSample
from time import sleep
import argparse
import logging

# Parse arguments
parser = argparse.ArgumentParser(prog=__file__, description='Calculates wave statistics from gpsd TPV data')
parser.add_argument('-s', dest='simulator', action='store_true', help='Use a simulated gpsd')
parser.add_argument('-g', dest='gpsd_host', help='Hostname and port as `hostname:port`')      # option that takes a value
parser.add_argument('-l', dest='log_level', default='INFO', help='Log level')
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
    
    components = args.gpsd_host.split(':')

    hostname = components[0]
    port = components[1]

    gpsdClient = GPSDClient(hostname, port)


# Get the analyzer and start the thread
analyzer = Analyzer(gpsdClient)

while True:
    input()
    logging.info(f'Significant wave height: {analyzer.significantWaveHeight()}')

