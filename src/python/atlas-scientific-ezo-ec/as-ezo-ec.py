#!/usr/bin/python3
from time import sleep
from datetime import datetime
import random
import sys
import argparse
import socket
from AtlasI2C import *

parser = argparse.ArgumentParser(description=\
    '''Read salinity from an Atlas Scientific EC EZO sensor, and publish over UDP port.  The data is published as a comma-separated series on one line.  These are the fields, in the order they will appear:

1) Date of the reading, in YYYY-MM-DDThh:mm:ss format
2) EC:  electrical conductivity (microS / cm)
3) TDS: total dissolved solids (ppm)
4) S:   salinity PSU (g / kg)
5) SG:  specific gravity''')
parser.add_argument('-a', dest='address', type=int, default=100, help='I2C address of the sensor, defaults to 100 (0x64)')
parser.add_argument('port', metavar='port', type=int, help='port to publish salinity')
parser.add_argument('--simulator', action='store_true')
args = parser.parse_args()

# Setup the device
if not args.simulator:
    device = AtlasI2C()
    device.set_i2c_address(args.address)
    assert(device.query('O,EC,1').error_code == 1)
    assert(device.query('O,TDS,1').error_code == 1)
    assert(device.query('O,S,1').error_code == 1)
    assert(device.query('O,SG,1').error_code == 1)


def getRealData():
    return [float(x) for x in device.query('R').response.split(',')]

def getFakeData():
    return [0, 0, 0, 0]


# Create socket
port = args.port

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', port))


while True:
    data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

    # Respond to anyone who sends us a packet
    if args.simulator:
        data = getFakeData()
    else:
        data = getRealData()

    now = datetime.utcnow()
    line = '%s,%9.2f,%9.2f,%9.2f,%9.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), data[0], data[1], data[2], data[3])

    sock.sendto(line.encode('utf8'), addr)
