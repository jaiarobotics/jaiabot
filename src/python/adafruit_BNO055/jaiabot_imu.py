#!/usr/bin/env python3
from time import sleep
from datetime import datetime
import random
import sys
import argparse
import socket
import logging
import time
from math import *
from dataclasses import dataclass

parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='DEBUG', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('--simulator', action='store_true')
parser.add_argument('--interactive', action='store_true')
args = parser.parse_args()

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')
log.setLevel(args.logging_level)

try:
    import adafruit_bno055
    import board
except ModuleNotFoundError:
    log.warning('ModuleNotFoundError, so physical device not available')
except NotImplementedError:
    log.warning('NotImplementedError, so physical device not available')

@dataclass
class Orientation:
    heading: float
    pitch: float
    roll: float

def quaternion_to_euler_angles(q: tuple):
    DEG = pi / 180

    # roll (x-axis rotation)
    sinr_cosp = 2 * (q[0] * q[1] + q[2] * q[3])
    cosr_cosp = 1 - 2 * (q[1] * q[1] + q[2] * q[2])
    roll = atan2(sinr_cosp, cosr_cosp)

    # pitch (y-axis rotation)
    sinp = sqrt(1 + 2 * (q[0] * q[2] - q[1] * q[3]))
    cosp = sqrt(1 - 2 * (q[0] * q[2] - q[1] * q[3]))
    pitch = -2 * atan2(sinp, cosp) + pi / 2

    # yaw (z-axis rotation)
    siny_cosp = 2 * (q[0] * q[3] + q[1] * q[2])
    cosy_cosp = 1 - 2 * (q[2] * q[2] + q[3] * q[3])
    yaw = -atan2(siny_cosp, cosy_cosp)

    if yaw < 0:
        yaw += (2 * pi)

    return Orientation(yaw / DEG, pitch / DEG, roll / DEG)


class IMU:

    # Vars used to reset IMU if we are receiving no data
    reset_count = 0
    max_reset_count = 15

    def __init__(self):
        self.is_setup = False

    def setup(self):
        if not self.is_setup:
            self.i2c = board.I2C()
            try:
                self.sensor = adafruit_bno055.BNO055_I2C(self.i2c, address=0x28)
            except ValueError: # From I2CDevice if not on 0x28: ValueError("No I2C device at address: 0x%x" % self.device_address)
                self.sensor = adafruit_bno055.BNO055_I2C(self.i2c, address=0x29)
            
            self.sensor.mode = adafruit_bno055.NDOF_MODE
            self.is_setup = True

            # Remap the axes of the IMU to match the physical placement in the JaiaBot (P2 in section 3.4 of the datasheet)
            self.sensor.axis_remap = (0, 1, 2, 1, 1, 0)

    def getData(self):
        if not self.is_setup:
            self.setup()

        try:
            quaternion = self.sensor.quaternion
            euler = self.sensor.euler
            accel = self.sensor.linear_acceleration
            gravity = self.sensor.gravity
            cal = self.sensor.calibration_status

            if quaternion[0] is None or euler[0] is None or accel[0] is None or gravity[0] is None or cal[0] is None:
                self.reset_count += 1
                if self.reset_count >= self.max_reset_count:
                    log.error('Reset IMU')
                    self.reset()
                    self.reset_count = 0
                
                return {
                    "is_data_good": False
                }
            else:
                # If the data is valid, reset the reset count and process the data
                self.reset_count = 0

                return {
                    "is_data_good": True,
                    "euler": euler,
                    "linear_acceleration": accel,
                    "gravity": gravity,
                    "calibration_status": cal,
                    "quaternion": quaternion,
                    "calculated_euler": quaternion_to_euler_angles(quaternion),
                }
        except OSError as e:
            self.is_setup = False
            raise e

    def reset(self):
        log.debug("Resetting IMU")
        self.sensor._reset


class IMUSimulator:
    def __init__(self):
        pass

    def setup(self):
        pass

    def getData(self):
        quaternion = (1, 0, 0, 0)

        return {
            "euler": (0.0, 0.0, 0.0),
            "linear_acceleration": (0.0, 0.0, 0.0),
            "gravity": (0.0, 0.0, 9.8),
            "calibration_status": (3, 3, 3, 3),
            "quaternion": quaternion,
            "calculated_euler": quaternion_to_euler_angles(quaternion)
        }


# Setup the sensor
if args.simulator:
    imu = IMUSimulator()
else:
    imu = IMU()


def do_port_loop():
    # Create socket
    port = args.port

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('', port))

    imu_timeout = 5
    previous_time = time.time()

    while True:

        data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes

        current_time = time.time()

        # Band aid to reset the IMU every so often due to heading lock errors
        # if (previous_time + imu_timeout) <= current_time:
        #     previous_time = current_time
        #     print("reset imu")
        #     imu.reset()

        # Respond to anyone who sends us a packet
        try:
            data = imu.getData()
            log.debug(data)
        except Exception as e:
            log.error(e)
            continue
        
        now = datetime.utcnow()
       
        if data['is_data_good'] == True:

            # Use caluclated Euler angles from the quaternion
            euler: Orientation = data['calculated_euler']
            linear_acceleration = data['linear_acceleration']
            gravity = data['gravity']
            calibration_status = data['calibration_status'] # 1 is calibrated, 0 is not
            bot_rolled = int(abs(euler.roll) > 90) # Did we roll over?
            corrected_heading = euler.heading + 90

            try:
                line = '%s,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%d,%d,%d,%d,%d\n' % \
                    (now.strftime('%Y-%m-%dT%H:%M:%SZ'), 
                    corrected_heading, euler.pitch, euler.roll,
                    linear_acceleration[0], linear_acceleration[2], linear_acceleration[1],
                    gravity[0], gravity[2], gravity[1],
                    calibration_status[0], calibration_status[1], calibration_status[2], calibration_status[3],
                    bot_rolled)
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

