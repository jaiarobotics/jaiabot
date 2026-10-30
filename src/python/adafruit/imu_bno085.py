from imu import *

import adafruit_bno08x
from adafruit_bno08x import _BNO_CHANNEL_CONTROL, _FEATURE_ENABLE_TIMEOUT, _elapsed
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
    # How long to sleep between checks of the UART while waiting for a new report
    POLL_INTERVAL_S = 0.001
    # The BNO085 streams reports on its own clock, so readings are paced by the sensor (see waitForReading)
    is_event_driven = True
    _device_path: str = "/dev/ttyAMA0"
    sensor: BNO08X_UART

    def __init__(self, device_path: str = "/dev/ttyAMA0", rate_hz: float = 10):
        self.is_setup = False
        self._lock = Lock()
        self._device_path = device_path
        self._last_quaternion = None
        self._setReportIntervals(rate_hz)
        imu_logger.debug(f"Adafruit BNO085 initialized with device path {self._device_path}")

    def _setReportIntervals(self, rate_hz: float):
        self._report_intervals_us = {feature: int(1e6 / rate_hz) for feature in self._enabled_features}
        imu_logger.info(f"BNO085 report rate {rate_hz} Hz")

    def setRate(self, rate_hz: float):
        """Change the rate the BNO085 reports at.  Takes effect immediately if the sensor is already set up."""
        with self._lock:
            self._setReportIntervals(rate_hz)
            if self.is_setup:
                for feature in self._report_intervals_us:
                    self._enable_feature(feature)

    def _enable_feature(self, feature_id: int):
        """Same as BNO08X.enable_feature(), but with our report interval (the library's is fixed at 50 ms)"""
        report = self.sensor._get_feature_enable_report(feature_id, report_interval=self._report_intervals_us[feature_id])
        self.sensor._send_packet(_BNO_CHANNEL_CONTROL, report)

        start_time = time.monotonic()
        while _elapsed(start_time) < _FEATURE_ENABLE_TIMEOUT:
            self.sensor._process_available_packets(max_packets=10)
            if feature_id in self.sensor._readings:
                return
        raise RuntimeError("Was not able to enable feature", feature_id)

    def _setup(self):
        """Thread unsafe setup function.  Only used internally."""
        if not self.is_setup:
            try:
                imu_logger.debug(f"Setting up Adafruit BNO085 on {self._device_path}")
                uart = serial.Serial(self._device_path, 3000000)
                imu_logger.debug('Serial connection established, now creating BNO08X_UART object')
                self.sensor = BNO08X_UART(uart)
                imu_logger.debug('Connected, now lets enable output')

                for feature in self._report_intervals_us:
                    self._enable_feature(feature)

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

    def _takeReading(self, only_if_new: bool = False):
        """Thread unsafe takeReading function.  Only used internally.

        With only_if_new, returns None unless a new rotation vector report has arrived since the last reading.
        Sets self._read_failed if the reading failed with an error.
        """
        self._read_failed = False
        if not self.is_setup:
            self._setup()

        try:
            # Drain the UART once, then read the latest reports directly. Each of the library's
            # properties (quaternion, gyro, ...) drains the UART again, which is too slow at 100 Hz.
            self.sensor._process_available_packets()
            readings = self.sensor._readings

            # The library stores a new tuple for each report it parses, so identity tells us whether
            # this is a new report, even if its values happen to match the previous one
            quaternion = readings.get(adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR)
            if only_if_new and (quaternion is None or quaternion is self._last_quaternion):
                return None
            self._last_quaternion = quaternion

            self.checkCalibration()

            missing = [feature for feature in self._report_intervals_us if readings.get(feature) is None]
            if missing:
                imu_logger.warning(f"No data yet for BNO085 reports {[hex(feature) for feature in missing]}")
                self._read_failed = True
                return None

            reading = IMUReading()

            reading.quaternion = Quaternion.from_xyzw(*readings[adafruit_bno08x.BNO_REPORT_ROTATION_VECTOR])

            reading.angular_velocity = Vector3(*readings[adafruit_bno08x.BNO_REPORT_GYROSCOPE])

            reading.orientation = reading.quaternion.to_euler_angles()
            # even after consulting the docs, we're still off by 90 degrees!
            reading.orientation.heading = (reading.orientation.heading + 90) % 360
            reading.linear_acceleration = Vector3(*readings[adafruit_bno08x.BNO_REPORT_LINEAR_ACCELERATION])
            reading.linear_acceleration_world = reading.quaternion.apply(reading.linear_acceleration)
            reading.gravity = Vector3(*readings[adafruit_bno08x.BNO_REPORT_GRAVITY])
            reading.calibration_state = self.calibration_state
            reading.accuracies = self.sensor.accuracies
            reading.magnetic_field = Vector3(*readings[adafruit_bno08x.BNO_REPORT_MAGNETOMETER])
            reading.acceleration = Vector3(*readings[adafruit_bno08x.BNO_REPORT_ACCELEROMETER])

            
            return reading

        except RuntimeError as error:
            self._read_failed = True
            if len(error.args) == 2 and error.args[0] == 'Unprocessable Batch bytes':
                self.is_setup = False
                imu_logger.warning(f"Handling error trying to get imu data {error} by retrying to connect to imu")
            else:
                imu_logger.warning(f"Unexpected RuntimeError trying to get imu data: {error}")
        except KeyError as error:
            # An unknown report ID, usually the start-up announcement after the BNO085 resets itself.
            # It comes back with no reports enabled, so set it up again.
            self._read_failed = True
            self.is_setup = False
            imu_logger.warning(f"Unknown BNO085 report {error} (sensor probably reset), retrying to connect to imu")
        except Exception as error:
            self._read_failed = True
            imu_logger.warning(f"Unexpected Exception trying to get imu data: {error}")

    def takeReading(self):
        """Thread-safe takeReading function.  Call to take a reading.


        Returns:
            IMUReading | None: An IMUReading object, if the reading was successful, otherwise None.
        """
        with self._lock:
            return self._takeReading()

    def waitForReading(self, timeout: float):
        """Thread-safe.  Wait for the BNO085 to send a new rotation vector report, and return a reading built from it.

        Returns:
            IMUReading | None: The new reading, or None on error or if no new report arrived within timeout seconds.
        """
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with self._lock:
                reading = self._takeReading(only_if_new=True)
                if reading is not None or self._read_failed or not self.is_setup:
                    return reading
            time.sleep(self.POLL_INTERVAL_S)
        return None

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

