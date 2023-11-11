from dataclasses import dataclass
from orientation import Orientation
from vector3 import Vector3
from typing import *
from quaternion import Quaternion
import logging
import datetime
from math import *
from jaiabot.messages.imu_pb2 import IMUData

import adafruit_bno08x
from adafruit_bno08x.uart import BNO08X_UART
import serial
import time

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('imu')


try:
    uart = serial.Serial("/dev/ttyAMA0", 3000000)
    physical_device_available = True
except ModuleNotFoundError:
    log.warning('ModuleNotFoundError, so physical device not available')
    physical_device_available = False
except NotImplementedError:
    log.warning('NotImplementedError, so physical device not available')
    physical_device_available = False
except serial.serialutil.SerialException:
    log.warning('SerialException, so physical device not available')


@dataclass
class IMUReading:
    orientation: Orientation
    linear_acceleration: Vector3
    linear_acceleration_world: Vector3
    gravity: Vector3
    calibration_status: int
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
        log.debug('About to take reading')
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

        if reading.calibration_status is not None:
            imu_data.calibration_status = reading.calibration_status

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
            try:
                uart.close()
                # allow for the port to close
                time.sleep(0.2)
                uart.open()

                log.warning('We are not setup')

                self.sensor = BNO08X_UART(uart)

                log.warning('Connected, now lets enable output')

                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_ACCELEROMETER)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_GYROSCOPE)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_MAGNETOMETER)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_GRAVITY)

                self.is_setup = True

                # Set the duration for checking calibration
                self.wait_to_check_cal_duration = 1

                # Set the initial time for checking calibration
                self.check_cal_time = time.time()

                # Set the initial calibration status
                self.calibration_status = None

            except Exception as error:
                self.is_setup = False
                log.warning("Error trying to setup driver!")
            

    def takeReading(self):
        if not self.is_setup:
            self.setup()

        try:
            quat_x, quat_y, quat_z, quat_w = self.sensor.quaternion
            quaternion = (quat_w, quat_x, quat_y, quat_z)
            linear_acceleration = self.sensor.linear_acceleration
            gravity = self.sensor.gravity
            calibration_status = self.calibration_status

            if time.time() - self.check_cal_time >= self.wait_to_check_cal_duration:
                logging.debug("Checking Calibration")
                try:
                    calibration_status = self.sensor.calibration_status
                    # Set the calibration status to save when we are not querying a 
                    # new calibration status
                    self.calibration_status = calibration_status
                except (RuntimeError, IndexError, KeyError, AttributeError) as error:
                    log.warning("Error trying to get calibration status!")
                self.check_cal_time = time.time()  # Reset the start time
            else:
                logging.debug("Waiting To Check Calibration")
           
            if None in quaternion or None in linear_acceleration or None in gravity:
                log.warning("We received None data in the takeReading function")
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

        except Exception as error:
                self.is_setup = False
                log.warning("Error trying to get data!")
    

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
                        gravity=Vector3(0.03, 0.03, 9.8), # We need to use 0.03, to avoid looking like a common glitch that gets filtered
                        calibration_status=(3, 3, 3, 3),
                        quaternion=quaternion)

