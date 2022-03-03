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


class IMU:

    def __init__(self):
        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            self.i2c = board.I2C()
            self.sensor = adafruit_bno055.BNO055_I2C(self.i2c)
            self.sensor.mode = adafruit_bno055.NDOF_MODE
            self.is_setup = True

    def getData(self):
        if not self.is_setup:
            self.setup()

        try:
            return {
                "euler": self.sensor.euler,
                "linear_acceleration": self.sensor.linear_acceleration,
                "gravity": self.sensor.gravity
            }
        except OSError as e:
            self.is_setup = False
            raise e


class IMUSimulator:
    def __init__(self):
        pass

    def setup(self):
        pass

    def getData(self):
        return {
            "euler": (0.0, 0.0, 0.0),
            "linear_acceleration": (0.0, 0.0, 0.0),
            "gravity": (0.0, 0.0, 9.8)
        }


# Setup the sensor
if args.simulator:
    imu = IMUSimulator()
else:
    imu = IMU()


# Create socket
port = args.port

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('', port))

while True:
    data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

    # Respond to anyone who sends us a packet
    try:
        data = imu.getData()
    except Exception as e:
        print(e)
        continue

    now = datetime.utcnow()
    euler = data['euler']
    linear_acceleration = data['linear_acceleration']
    gravity = data['gravity']
    try:
        line = '%s,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f\n' % \
            (now.strftime('%Y-%m-%dT%H:%M:%SZ'), 
            euler[0], euler[1], euler[2], 
            linear_acceleration[0], linear_acceleration[1], linear_acceleration[2],
            gravity[0], gravity[1], gravity[2])
    except TypeError as e:
        print(e)

    print('Sent: ', line)
    sock.sendto(line.encode('utf8'), addr)

