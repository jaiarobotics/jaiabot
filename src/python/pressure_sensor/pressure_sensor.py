#!/usr/bin/python3
from time import sleep
from datetime import datetime
import random
import sys
import argparse
import socket
import ms5837

parser = argparse.ArgumentParser(description='Read temperature and pressure from a Bar30 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish T & P')
parser.add_argument('--simulator', action='store_true')
parser.add_argument('--device', metavar='device', type=str, default='bar30', help='device type (bar30 or bar02)')
args = parser.parse_args()

if args.device != 'bar02':
    args.device = 'bar30'

print(args)



# Setup the Bar30
if not args.simulator:
    if args.device == 'bar02':
        sensor = ms5837.MS5837_02BA() # Default I2C bus is 1 (Raspberry Pi 3)
    else:
        sensor = ms5837.MS5837_30BA() # Default I2C bus is 1 (Raspberry Pi 3)

    if not sensor.init():
            print("Sensor could not be initialized")
            exit(1)

    if not sensor.read():
        print("Sensor read failed!")
        exit(1)


def getRealPT():
    try:
        if sensor.read():
            return (sensor.pressure(), sensor.temperature())
        else:
            print("Sensor read failed!")
            exit(1)
    except OSError as error:
        # Temporary read errors come through as OSError exceptions
        print("Error: ", error)


def getFakePT():
    return (random.uniform(1300, 1400), random.uniform(20, 25))


# Create socket
port = args.port

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', port))

while True:
    data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

    # Respond to anyone who sends us a packet
    if args.simulator:
        p_mbar, t_celsius = getFakePT()
    else:
        p_mbar, t_celsius = getRealPT()

    now = datetime.utcnow()
    line = '%s,%9.2f,%7.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), p_mbar, t_celsius)

    sock.sendto(line.encode('utf8'), addr)
