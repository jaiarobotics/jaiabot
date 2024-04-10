from dataclasses import dataclass
from orientation import Orientation
from vector3 import Vector3
from typing import *
from quaternion import Quaternion
import logging
import datetime
from math import *
from jaiabot.messages.imu_pb2 import IMUData
from imu import *
from imu_reading import *


logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('imu')


try:
    import adafruit_bno055
    import board
    physical_device_available = True
except ModuleNotFoundError:
    log.warning('ModuleNotFoundError, so physical device not available')
    physical_device_available = False
except NotImplementedError:
    log.warning('NotImplementedError, so physical device not available')
    physical_device_available = False


class AdafruitBNO055(IMU):

    def __init__(self):
        log.info('Device: Adafruit')

        if not physical_device_available:
            log.error('No physical device available')
            exit(1)

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

    def takeReading(self):
        if not self.is_setup:
            self.setup()

        try:
            quaternion = self.sensor.quaternion
            euler = self.sensor.euler
            linear_acceleration = self.sensor.linear_acceleration
            gravity = self.sensor.gravity
            calibration_status = self.sensor.calibration_status
            
            if None in quaternion or None in euler or None in linear_acceleration or None in gravity or None in calibration_status:
                return None

            # This is a very glitchy IMU, so we need to check for absurd values, and set those vectors to zero if we find them
            def filter(iterable: Iterable[float], threshold: float=50):
                for value in iterable:
                    if abs(value) > threshold:
                        return [0.0] * len(iterable)
                return iterable

            linear_acceleration = filter(linear_acceleration)
            gravity = filter(gravity)
            angular_velocity = Vector3(*self.sensor.gyro)

            quaternion = Quaternion.from_tuple(quaternion)
            orientation = quaternion.to_euler_angles()
            orientation.heading = (orientation.heading + 90) % 360 # Even after consulting the docs, we're still off by 90 degrees!
            linear_acceleration = Vector3(*linear_acceleration)
            linear_acceleration_world = quaternion.apply(linear_acceleration)
            gravity = Vector3(*gravity)

            reading = IMUReading(orientation=orientation, 
                        linear_acceleration=linear_acceleration, 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=gravity,
                        calibration_status=calibration_status,
                        quaternion=quaternion,
                        angular_velocity=angular_velocity)
            
            def isValidReading(reading: IMUReading):
                '''Returns True if this reading doesn't contain an obvious glitch in gravity or linear_acceleration'''

                g_mag = reading.gravity.magnitude()
                a_mag = reading.linear_acceleration.magnitude()
                if g_mag < 8 or g_mag > 50:
                    return False
                
                if abs(reading.gravity.x) < 0.02 or abs(reading.gravity.y) < 0.02 or abs(reading.gravity.z) < 0.02: # Sometimes the gravity components glitch out to 0.01 for no reason
                    return False
                
                if a_mag == 0 or a_mag > 50:
                    return False

                return True
            
            if isValidReading(reading):
                return reading
            else:
                return None


        except OSError as e:
            self.is_setup = False
            raise e
