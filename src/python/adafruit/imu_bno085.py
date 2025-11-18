from imu import *

import adafruit_bno08x
from adafruit_bno08x.uart import BNO08X_UART
import serial
import time
from threading import Lock

imu_logger = logging.getLogger('imu.adafruit_bno085')

class AdafruitBNO085(IMU):
    _lock = Lock()
    _enabled_features: list[int] = [
        adafruit_bno08x.BNO_REPORT_ACCELEROMETER,
        adafruit_bno08x.BNO_REPORT_GYROSCOPE,
        adafruit_bno08x.BNO_REPORT_MAGNETOMETER,

        adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR,
        adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION,
        adafruit_bno08x.BNO_REPORT_GRAVITY
    ]
    _device_path: str = "/dev/ttyAMA0"
    sensor: BNO08X_UART

    def __init__(self, device_path: str = "/dev/ttyAMA0"):
        self.is_setup = False
        self._lock = Lock()
        self._device_path = device_path
        imu_logger.debug(f"Adafruit BNO085 initialized with device path {self._device_path}")

    def _setup(self):
        """Thread unsafe setup function.  Only used internally."""
        if not self.is_setup:
            try:
                imu_logger.debug(f"Setting up Adafruit BNO085 on {self._device_path}")
                uart = serial.Serial(self._device_path, 3000000)
                imu_logger.debug('Serial connection established, now creating BNO08X_UART object')
                self.sensor = BNO08X_UART(uart)
                imu_logger.debug('Connected, now lets enable output')

                for feature in self._enabled_features:
                    self.sensor.enable_feature(feature)

                self.is_setup = True
                self.magnetometer_accuracy = None
                self.calibration_state = None
                # set the duration for checking calibration (seconds)
                self.wait_to_check_calibration_duration = 1
                # set the initial time for checking calibration
                self.check_calibration_time = time.time()

            except Exception as error:
                self.is_setup = False
                imu_logger.error(f"Adafruit BNO085 setup error: {error}")
            
    def setup(self):
        """Thread-safe setup function.  Call to setup the IMU."""
        with self._lock:
            self._setup()

    def _takeReading(self):
        """Thread unsafe takeReading function.  Only used internally."""
        if not self.is_setup:
            self._setup()

        try:
            self.checkCalibration()

            if None in self.sensor.quaternion or None in self.sensor.linear_acceleration or None in self.sensor.gravity:
                imu_logger.warning("We received None data in the takeReading function")
                imu_logger.debug(f"Quaternion data: {self.sensor.quaternion}")
                imu_logger.debug(f"Gravity data: {self.sensor.gravity}")
                imu_logger.debug(f"Linear acceleration data: {self.sensor.linear_acceleration}")
                return None

            reading = IMUReading()

            reading.quaternion = Quaternion.from_xyzw(*self.sensor.quaternion)

            reading.angular_velocity = Vector3(*self.sensor.gyro)

            reading.orientation = reading.quaternion.to_euler_angles()
            # even after consulting the docs, we're still off by 90 degrees!
            reading.orientation.heading = (reading.orientation.heading + 90) % 360
            reading.linear_acceleration = Vector3(*self.sensor.linear_acceleration)
            reading.linear_acceleration_world = reading.quaternion.apply(reading.linear_acceleration)
            reading.gravity = Vector3(*self.sensor.gravity)
            reading.calibration_state = self.calibration_state
            reading.accuracies = self.sensor.accuracies
            reading.magnetic_field = Vector3(*self.sensor.magnetic)
            reading.acceleration = Vector3(*self.sensor.acceleration)

            
            return reading

        except RuntimeError as error:
            if len(error.args) == 2 and error.args[0] == 'Unprocessable Batch bytes':
                self.is_setup = False
                imu_logger.warning(f"Handling error trying to get imu data {error} by retrying to connect to imu")
            else:
                imu_logger.warning(f"Unexpected RuntimeError trying to get imu data: {error}")
        except Exception as error:
            imu_logger.warning(f"Unexpected Exception trying to get imu data: {error}")

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
                self.magnetometer_accuracy = self.sensor.accuracies.magnetometer

                if self.calibration_state == CalibrationState.IN_PROGRESS:
                    logging.debug("Calibrating imu")
                    if not self.calibration_good_at and self.magnetometer_accuracy > 2:
                        self.calibration_good_at = time.monotonic()
                        logging.debug("Record time of good calibration")
                    if self.calibration_good_at and (time.monotonic() - self.calibration_good_at > 5.0):
                        logging.debug("Good calibration has been achieved for over 5 seconds, saving calibration data")
                        self.sensor.save_calibration_data()
                        self.calibration_good_at = None
                        self.calibration_state = CalibrationState.COMPLETE
            except Exception as error:
                imu_logger.warning("Error trying to get calibration status!")
            # reset the start time
            self.check_calibration_time = time.time()
        else:
            logging.debug("Waiting To Check Calibration")

