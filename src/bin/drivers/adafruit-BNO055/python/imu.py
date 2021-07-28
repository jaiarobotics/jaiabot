#!/usr/bin/env python3
from time import sleep
from datetime import datetime
import random
import sys
import argparse
import socket

try:
    import adafruit_bno055
    import board
except NotImplementedError:
    print('Warning:  physical device not available')


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('--simulator', action='store_true')
args = parser.parse_args()

# Setup the sensor
if not args.simulator:
    i2c = board.I2C()
    sensor = adafruit_bno055.BNO055_I2C(i2c)
    sensor.mode = adafruit_bno055.NDOF_MODE


def getRealData():
    return {
        "euler": sensor.euler,
        "linear_acceleration": sensor.linear_acceleration,
        "gravity": sensor.gravity
    }


def getFakeData():
    return {
        "euler": (0.0, 0.0, 0.0),
        "linear_acceleration": (0.0, 0.0, 0.0),
        "gravity": (0.0, 0.0, 9.8)
    }


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
    euler = data['euler']
    linear_acceleration = data['linear_acceleration']
    gravity = data['gravity']
    line = '%s,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f\n' % \
        (now.strftime('%Y-%m-%dT%H:%M:%SZ'), 
         euler[0], euler[1], euler[2], 
         linear_acceleration[0], linear_acceleration[1], linear_acceleration[2],
         gravity[0], gravity[1], gravity[2])

    sock.sendto(line.encode('utf8'), addr)

