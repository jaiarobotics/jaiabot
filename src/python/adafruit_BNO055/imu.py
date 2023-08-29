from dataclasses import dataclass
from orientation import Orientation
from vector3 import Vector3
from typing import *
from quaternion import Quaternion
import logging
import datetime
from math import *
from jaiabot.messages.imu_pb2 import IMUData


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
class IMUReading:
    orientation: Orientation
    linear_acceleration: Vector3
    linear_acceleration_world: Vector3
    gravity: Vector3
    calibration_status: tuple
    quaternion: Quaternion


class IMU:
    def setup(self):
        pass

    def takeReading(self):
        return IMUReading()

    def getIMUData(self):
        """Returns an IMUData protobuf object, suitable for sending over UDP

        Returns:
            IMUData: the reading as an IMUData
        """
        reading = self.takeReading()

        if reading is None:
            return None

        imu_data = IMUData()
        imu_data.euler_angles.heading = reading.orientation.heading
        imu_data.euler_angles.pitch = reading.orientation.pitch
        imu_data.euler_angles.roll = reading.orientation.roll

        imu_data.linear_acceleration.x = reading.linear_acceleration.x
        imu_data.linear_acceleration.y = reading.linear_acceleration.y
        imu_data.linear_acceleration.z = reading.linear_acceleration.z

        imu_data.gravity.x = reading.gravity.x
        imu_data.gravity.y = reading.gravity.y
        imu_data.gravity.z = reading.gravity.z

        imu_data.calibration_status.sys = reading.calibration_status[0]
        imu_data.calibration_status.gyro = reading.calibration_status[1]
        imu_data.calibration_status.accel = reading.calibration_status[2]
        imu_data.calibration_status.mag = reading.calibration_status[3]

        return imu_data


class Adafruit(IMU):

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

            quaternion = Quaternion.from_tuple(quaternion)
            orientation = quaternion.to_euler_angles()
            orientation.heading = (orientation.heading + 90) % 360 # Even after consulting the docs, we're still off by 90 degrees!
            linear_acceleration = Vector3(*linear_acceleration)
            linear_acceleration_world = quaternion.apply(linear_acceleration)
            gravity = Vector3(*gravity)

            return IMUReading(orientation=orientation, 
                        linear_acceleration=linear_acceleration, 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=gravity,
                        calibration_status=calibration_status,
                        quaternion=quaternion)

        except OSError as e:
            self.is_setup = False
            raise e
    

class Simulator(IMU):
    wave_frequency: float
    wave_height: float

    def __init__(self, wave_frequency: float=1, wave_height: float=1):
        log.info('Device: Simulator')

        self.wave_frequency = wave_frequency
        self.wave_height = wave_height

    def setup(self):
        pass

    def takeReading(self) -> IMUReading:
        t = datetime.datetime.now().timestamp()
        a_z = self.wave_height * 0.5 * sin(t * 2 * pi * self.wave_frequency) * (2 * pi * self.wave_frequency) ** 2
        linear_acceleration = Vector3(0, 0, a_z)

        quaternion = Quaternion(1, 0, 0, 0)
        linear_acceleration_world = quaternion.apply(linear_acceleration)

        return IMUReading(orientation=quaternion.to_euler_angles(), 
                        linear_acceleration=linear_acceleration,
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=Vector3(0, 0, 9.8),
                        calibration_status=(3, 3, 3, 3),
                        quaternion=quaternion)

