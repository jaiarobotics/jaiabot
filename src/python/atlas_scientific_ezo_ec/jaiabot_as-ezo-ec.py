#!/usr/bin/python3
from time import sleep
from datetime import datetime
import random
import sys
import argparse
import socket
from AtlasI2C import *
import logging

parser = argparse.ArgumentParser(description=\
    '''Read salinity from an Atlas Scientific EC EZO sensor, and publish over UDP port.  The data is published as a comma-separated series on one line.  These are the fields, in the order they will appear:

1) Date of the reading, in YYYY-MM-DDThh:mm:ss format
2) EC:  electrical conductivity (microS / cm)
3) TDS: total dissolved solids (ppm)
4) S:   salinity PSU (g / kg)
5) SG:  specific gravity''')
parser.add_argument('-a', dest='address', type=int, default=100, help='I2C address of the sensor, defaults to 100 (0x64)')
parser.add_argument('port', metavar='port', type=int, help='port to publish salinity')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('--simulator', action='store_true')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('salinity')
log.setLevel(args.logging_level)


class SensorError(Exception):
    pass


class Sensor:

    def __init__(self):
        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            self.device = AtlasI2C()
            self.device.set_i2c_address(args.address)
            if self.device.query('O,EC,1').error_code  == 1 and \
               self.device.query('O,TDS,1').error_code == 1 and \
               self.device.query('O,S,1').error_code   == 1 and \
               self.device.query('O,SG,1').error_code  == 1:
                self.is_setup = True
            else:
                raise SensorError()

    def read(self):
        if not self.is_setup:
            self.setup()

        response = self.device.query('R')
        if response.error_code != 1:
            raise SensorError(f'response code = {response.error_code}')

        data = [float(x) for x in response.response.split(',')]

        return data


class SensorSimulator:

    def __init__(self):
        pass

    def setup(self):
        pass

    def read(self):
        return [0, 0, 0, 0]

# Setup the device
if args.simulator:
    sensor = SensorSimulator()
else:
    sensor = Sensor()


# Create socket
port = args.port

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', port))


while True:
    data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

    # Respond to anyone who sends us a packet
    try:
        data = sensor.read()
    except Exception as e:
        log.warning(e)
        continue

    now = datetime.utcnow()
    line = '%s,%9.2f,%9.2f,%9.2f,%9.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), data[0], data[1], data[2], data[3])

    sock.sendto(line.encode('utf8'), addr)
    log.debug(f'Sent: {line}')
