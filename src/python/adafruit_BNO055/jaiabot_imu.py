#!/usr/bin/env python3
from time import sleep
from datetime import datetime
import argparse
import socket
import logging
from math import *
from orientation import Orientation
from imu import *


logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('--simulator', action='store_true')
parser.add_argument('--interactive', action='store_true')
args = parser.parse_args()

log.setLevel(args.logging_level)



# Setup the sensor
imu: IMU

if args.simulator:
    imu = Simulator()
else:
    imu = Adafruit()


def do_port_loop():
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
            log.error(e)
            continue
        
        now = datetime.utcnow()
        
        # Use caluclated Euler angles from the quaternion
        euler: Orientation = data.orientation
        calibration_status = data.calibration_status
        bot_rolled = int(abs(euler.roll) > 90) # Did we roll over?

        try:
            line = f'{now.strftime("%Y-%m-%dT%H:%M:%SZ")},{euler.to_string()},{data.linear_acceleration.to_string()},{data.gravity.to_string()},' \
                   f'{calibration_status[0]},{calibration_status[1]},{calibration_status[2]},{calibration_status[3]},{bot_rolled}'
            log.debug('Sent: ' + line)

            sock.sendto(line.encode('utf8'), addr)
        except TypeError as e:
            log.error(e)


def do_interactive_loop():
    while True:
        input()
        print(imu.getData())



if __name__ == '__main__':
    if args.interactive:
        do_interactive_loop()
    else:
        do_port_loop()

