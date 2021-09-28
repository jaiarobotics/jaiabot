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
args = parser.parse_args()

print(args)

# Setup the Bar30
if not args.simulator:
    sensor = ms5837.MS5837_30BA() # Default I2C bus is 1 (Raspberry Pi 3)
    sensor.is_initialized = False

class SensorReadError(Exception):
    pass

def getRealPT():
    try:
        if not sensor.is_initialized:
            if sensor.init():
                sensor.is_initialized = True
            else:
                raise SensorReadError

        if sensor.read():
            return (sensor.pressure(), sensor.temperature())
        else:
            raise SensorReadError
    except OSError as error:
        raise SensorReadError


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
        try:
            p_mbar, t_celsius = getRealPT()
        except SensorReadError:
            print('Sensor read error!')
            continue

    now = datetime.utcnow()
    line = '%s,%9.2f,%7.2f\n' % (now.strftime('%Y-%m-%dT%H:%M:%SZ'), p_mbar, t_celsius)

    sock.sendto(line.encode('utf8'), addr)
