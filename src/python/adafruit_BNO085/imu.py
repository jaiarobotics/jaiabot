from dataclasses import dataclass
from enum import Enum
from orientation import Orientation
from vector3 import Vector3
from typing import *
from quaternion import Quaternion
import os
import logging
import datetime
from math import *
from jaiabot.messages.imu_pb2 import IMUData

import adafruit_bno08x
from adafruit_bno08x.uart import BNO08X_UART
import serial
import time

log_file_path = os.path.expanduser('~/app.log')
logging.basicConfig(filename=log_file_path, level=logging.DEBUG, filemode="w", format='%(asctime)s %(levelname)10s %(message)s')
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

class CalibrationState(Enum):
    IN_PROGRESS = 1
    COMPLETE = 2

@dataclass
class IMUReading:
    orientation: Orientation
    linear_acceleration: Vector3
    linear_acceleration_world: Vector3
    gravity: Vector3
    calibration_status: int
    calibration_state: CalibrationState
    quaternion: Quaternion

class IMU:
    def setup(self):
        pass

    def takeReading(self):
        return IMUReading()

    def getIMUData(self) -> IMUData:
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

        if reading.calibration_state is not None:
            # .value converts enum type to int (which the protobuf side is looking for)
            imu_data.calibration_state = reading.calibration_state.value

        return imu_data
    
    def startCalibration(self):
        pass


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
                log.warning('We are not setup')

                self.sensor = BNO08X_UART(uart)

                log.info('Connected, now lets enable output')

                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_ACCELEROMETER)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_GYROSCOPE)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_MAGNETOMETER)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION)
                self.sensor.enable_feature(adafruit_bno08x.BNO_REPORT_GRAVITY)

                self.is_setup = True
                self.calibration_status = None
                self.calibration_state = None
                # set the duration for checking calibration (seconds)
                self.wait_to_check_calibration_duration = 1
                # set the initial time for checking calibration
                self.check_calibration_time = time.time()

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
            calibration_state = self.calibration_state

            self.checkCalibration()
           
            if None in quaternion or None in linear_acceleration or None in gravity:
                log.warning("We received None data in the takeReading function")
                return None

            # this is a very glitchy IMU, so we need to check for absurd values, and set those vectors to zero if we find them
            def filter(iterable: Iterable[float], threshold: float=50):
                for value in iterable:
                    if abs(value) > threshold:
                        return [0.0] * len(iterable)
                return iterable

            linear_acceleration = filter(linear_acceleration)
            gravity = filter(gravity)

            quaternion = Quaternion.from_tuple(quaternion)
            orientation = quaternion.to_euler_angles()
            # even after consulting the docs, we're still off by 90 degrees!
            orientation.heading = (orientation.heading + 90) % 360
            linear_acceleration = Vector3(*linear_acceleration)
            linear_acceleration_world = quaternion.apply(linear_acceleration)
            gravity = Vector3(*gravity)

            return IMUReading(orientation=orientation, 
                        linear_acceleration=linear_acceleration, 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=gravity,
                        calibration_status=calibration_status,
                        calibration_state=calibration_state,
                        quaternion=quaternion)

        except Exception as error:
            log.warning("Error trying to get data!")

    def startCalibration(self):
        self.calibration_state = CalibrationState.IN_PROGRESS
        self.calibration_good_at = None
        self.sensor.begin_calibration()

    def checkCalibration(self):
        if time.time() - self.check_calibration_time >= self.wait_to_check_calibration_duration:
            logging.debug("Checking Calibration")
            try:
                # set the calibration status to save when we are not querying a 
                # new calibration status
                self.calibration_status = self.sensor.calibration_status

                if self.calibration_state == CalibrationState.IN_PROGRESS:
                    logging.debug("Calibrating imu")
                    if not self.calibration_good_at and self.calibration_status > 2:
                        self.calibration_good_at = time.monotonic()
                        logging.debug("Record time of good calibration")
                    if self.calibration_good_at and (time.monotonic() - self.calibration_good_at > 5.0):
                        logging.debug("Good calibration has been achieved for over 5 seconds, saving calibration data")
                        self.sensor.save_calibration_data()
                        self.calibration_good_at = None
                        self.calibration_state = CalibrationState.COMPLETE
            except Exception as error:
                log.warning("Error trying to get calibration status!")
            # reset the start time
            self.check_calibration_time = time.time()
        else:
            logging.debug("Waiting To Check Calibration")

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
                        # we need to use 0.03, to avoid looking like a common glitch that gets filtered
                        gravity=Vector3(0.03, 0.03, 9.8),
                        calibration_status=3,
                        quaternion=quaternion,
                        calibration_state=CalibrationState.COMPLETE)

