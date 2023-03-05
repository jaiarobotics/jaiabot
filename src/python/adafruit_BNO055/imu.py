from dataclasses import dataclass
from orientation import Orientation
from vector3 import Vector3
from typing import Protocol
from quaternion import Quaternion
import logging
import datetime
from math import *


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


@dataclass
class IMUData:
    orientation: Orientation
    linear_acceleration: Vector3
    linear_acceleration_world: Vector3
    gravity: Vector3
    calibration_status: tuple
    quaternion: Quaternion


class IMU(Protocol):
    def setup(self):
        pass

    def getData(self) -> IMUData:
        return IMUData()


class Adafruit:

    def __init__(self):
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

    def getData(self):
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


class Simulator:
    wave_frequency: float
    wave_height: float

    def __init__(self, wave_frequency: float=1, wave_height: float=1):
        self.wave_frequency = wave_frequency
        self.wave_height = wave_height

    def setup(self):
        pass

    def getData(self) -> IMUData:
        t = datetime.datetime.now().timestamp()
        a_z = self.wave_height * 0.5 * sin(t * 2 * pi * self.wave_frequency) * (2 * pi * self.wave_frequency) ** 2
        linear_acceleration = Vector3(0, 0, a_z)

        quaternion = Quaternion(1, 0, 0, 0)
        linear_acceleration_world = quaternion.apply(linear_acceleration)

        return IMUData(orientation=quaternion.to_euler_angles(), 
                        linear_acceleration=linear_acceleration,
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=Vector3(0, 0, 9.8),
                        calibration_status=(3, 3, 3, 3),
                        quaternion=quaternion)

