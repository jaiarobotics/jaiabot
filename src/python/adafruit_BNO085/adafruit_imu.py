#Standard modules
import logging
import serial
import time
from threading import Lock

# Jaia modules
from imu import IMU
from quaternion import Quaternion
from vector3 import Vector3
from imu_reading import *


log = logging.getLogger('imu')

try:
    import adafruit_bno08x
    from adafruit_bno08x.uart import BNO08X_UART
    physical_device_available = True
except Exception as e:
    log.warning(f'Physical device not available: {e}')
    physical_device_available = False


class Adafruit(IMU):
    _lock: Lock

    def __init__(self):
        log.info('Device: Adafruit')

        if not physical_device_available:
            log.error('No physical device available')
            exit(1)

        self.is_setup = False

        self._lock = Lock()

    def _setup(self):
        """Thread unsafe setup function.  Only used internally."""
        if not self.is_setup:
            try:
                log.warning('We are not setup')

                uart = serial.Serial("/dev/ttyAMA0", 3000000)
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
                log.error("Cannot setup Adafruit driver: {error}")
            
    def setup(self):
        """Thread-safe setup function.  Call to setup the IMU."""
        with self._lock:
            self._setup()

    def _takeReading(self):
        """Thread unsafe takeReading function.  Only used internally."""
        if not self.is_setup:
            self._setup()

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
            log.warning(f"Error trying to get data: {error}")

    def takeReading(self):
        """Thread-safe takeReading function.  Call to take a reading.


        Returns:
            IMUReading | None: An IMUReading object, if the reading was successful, otherwise None.
        """
        with self._lock:
            return self._takeReading()

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


