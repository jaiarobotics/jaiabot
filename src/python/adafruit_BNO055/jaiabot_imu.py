#!/usr/bin/env python3
from time import sleep
from datetime import datetime
import argparse
import socket
import logging
from math import *
from dataclasses import dataclass
from quaternion import Quaternion
from vector3 import Vector3
from orientation import Orientation


logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('jaiabot_imu')


try:
    import adafruit_bno055
    import board
except ModuleNotFoundError:
    log.warning('ModuleNotFoundError, so physical device not available')
except NotImplementedError:
    log.warning('NotImplementedError, so physical device not available')


parser = argparse.ArgumentParser(description='Read orientation, linear acceleration, and gravity from an AdaFruit BNO055 sensor, and publish them over UDP port')
parser.add_argument('port', metavar='port', type=int, help='port to publish orientation data')
parser.add_argument('-l', dest='logging_level', default='WARNING', type=str, help='Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG), default is WARNING')
parser.add_argument('--simulator', action='store_true')
parser.add_argument('--interactive', action='store_true')
args = parser.parse_args()

log.setLevel(args.logging_level)


@dataclass
class IMUData:
    orientation: Orientation
    linear_acceleration: Vector3
    linear_acceleration_world: Vector3
    gravity: Vector3
    calibration_status: tuple
    quaternion: Quaternion


class IMU:

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

    def getData(self) -> IMUData:
        if not self.is_setup:
            self.setup()

        try:
            quaternion = Quaternion(self.sensor.quaternion)
            orientation = quaternion.to_euler_angles()
            orientation.heading += 90 # Even after consulting the docs, we're still off by 90 degrees!
            linear_acceleration_world = quaternion.apply(Vector3(*self.sensor.linear_acceleration))

            return IMUData(orientation=orientation, 
                           linear_acceleration=self.sensor.linear_acceleration, 
                           linear_acceleration_world=linear_acceleration_world,
                           gravity=Vector3(self.sensor.gravity),
                           calibration_status=self.sensor.calibration_status,
                           quaternion=quaternion)

        except OSError as e:
            self.is_setup = False
            raise e

    def reset(self):
        self.sensor._reset


class IMUSimulator:
    def __init__(self):
        pass

    def setup(self):
        pass

    def getData(self) -> IMUData:
        quaternion = Quaternion(1, 0, 0, 0)
        linear_acceleration_world = quaternion.apply(Vector3(0, 0, 0))

        return IMUData(orientation=quaternion.to_euler_angles(), 
                        linear_acceleration=Vector3(0, 0, 0), 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=Vector3(0, 0, 9.8),
                        calibration_status=(3, 3, 3, 3),
                        quaternion=quaternion)


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

