from imu import *

import serial
from time import sleep
import time
from threading import Lock

class NaviguiderCommands(Enum):
    SELF_TEST = b'B' # Run RM3100 Self tests
    SENSOR_DATA_OFF = b'D0' # sensor Data display off
    SENSOR_DATA_ON = b'D1' # sensor Data display on
    SENSOR_DATA_TOGGLE = b'D\r' # Toggle sensor Data display (on/off) Default (On)
    START_AUTOCAL = b'J0' # Start autocal
    STOP_AUTOCAL = b'J1' # Stop autocal (this will reset the current autocal values)
    PAUSE_AUTOCAL = b'J2' # Pauses autocal. Sending J2 again will resume autocal from where it left off
    NED_MODE = b'J3' # Set module to NED orientation
    ENU_MODE = b'J4' # Set module to ENU orientation (Default)
    META_OFF = b'm0' # Meta event reporting off
    META_ON = b'm1' # Meta event reporting on
    META_TOGGLE = b'm\r' # Toggle meta event reporting(on/off) Default (On)
    MOUNT_Z_DOWN_180 = b'M15\r' # Mounting Option
    SENSOR_INFO = b'n' # Display sensor information
    VERSION = b'v' # Display Version
    ONE_SHOT_ORIENTATION = b'0' # One-Shot Orientation Sensor*
    POWER_DOWN = b'P' # Power Down (Low power mode)
    SAVE_CALIBRATION = b'S' # Save factory calibration parameters
    VERBOSE_OFF = b'V0' # Verbose Mode off
    VERBOSE_ON = b'V1' # Verbose Mode on
    VERBOSE_TOGGLE = b'V\r' # Toggle Verbose Mode (on/off) Default (On)
    RESTART_SYSTEM = b'X' # Restart system
    # SENSORS
    ORIENTATION_5Hz = b's 3,5\r'
    GYROSCOPE_5Hz = b's 4,5\r'
    GRAVITY_5Hz = b's 9,5\r'
    LINEAR_ACCELERATION_5Hz = b's 10,5\r'
    ROTATION_VECTOR_5Hz = b's 11,5\r'

class Naviguider(IMU):
    def __init__(self):
        self.rotation_vector = None
        self.orientation = None
        self.gravity = None
        self.linear_acceleration = None
        self.gyroscope = None
        self.is_setup = False
        self.calibration_acceptable = 10
        self.calibration_acceptable_time = 5
        self.lock = Lock()

    def _setup(self):
        """Thread unsafe setup function.  Only used internally."""
        if not self.is_setup:
            try:
                log.warning('We are not setup')

                uart = serial.Serial("/dev/ttyUSB0", 115200)

                self.sensor = uart

                log.info('Connected, now lets enable output')

                self.configure_imu()
          
                self.is_setup = True
                self.calibration_status = None
                self.calibration_state = None
                # set the duration for checking calibration (seconds)
                self.wait_to_check_calibration_duration = 1
                # set the initial time for checking calibration
                self.check_calibration_time = time.time()

            except Exception as error:
                self.is_setup = False
                log.error(f"NaviGuider setup error: {error}")
            
    def setup(self):
        """Thread-safe setup function.  Call to setup the IMU."""
        with self.lock:
            self._setup()

    def _takeReading(self):
        """Thread unsafe takeReading function.  Only used internally."""
        if not self.is_setup:
            self._setup()

        try:
            if self.get_rotation_vector() is not None:
                (quat_x, quat_y, quat_z, quat_w, quat_accuracy) = self.get_rotation_vector()
            else:
                log.warning("We received None data in the takeReading function for get_rotation_vector data")
                return None

            if self.get_linear_acceleration() is not None:
                (accel_x, accel_y, accel_z, accel_accuracy) = self.get_linear_acceleration()
            else:
                log.warning("We received None data in the takeReading function for get_linear_acceleration data")
                return None   

            if self.get_gravity() is not None:
                (gravity_x, gravity_y, gravity_z, gravity_accuracy) = self.get_gravity()
            else:
                log.warning("We received None data in the takeReading function for get_gravity data")
                return None   

            if self.get_orientation() is not None:
                (yaw, pitch, roll, calibration_status) = self.get_orientation()
            else:
                log.warning("We received None data in the takeReading function for get_orientation data")
                return None 

            if self.get_gyroscope() is not None:
                (gyro_x, gyro_y, gyro_z, gyro_accuracy) = self.get_gyroscope()
            else:
                log.warning("We received None data in the takeReading function for get_gyroscope data")
                return None 
        
            quaternion = Quaternion.from_tuple((quat_w, quat_x, quat_y, quat_z))
            linear_acceleration = Vector3(*(accel_x, accel_y, accel_z))
            gravity = Vector3(*(gravity_x, gravity_y, gravity_z))
            orientation = Orientation(yaw, pitch, roll)
            angular_velocity = Vector3(*(gyro_x, gyro_y, gyro_z))
            linear_acceleration_world = quaternion.apply(linear_acceleration)

            return IMUReading(orientation=orientation, 
                        linear_acceleration=linear_acceleration, 
                        linear_acceleration_world=linear_acceleration_world,
                        gravity=gravity,
                        calibration_status=int(calibration_status),
                        calibration_state=CalibrationState.COMPLETE,
                        quaternion=quaternion,
                        angular_velocity=angular_velocity)

        except Exception as error:
            log.warning(f"Error trying to get data: {error}")

    def takeReading(self):
        """Thread-safe takeReading function.  Call to take a reading.


        Returns:
            IMUReading | None: An IMUReading object, if the reading was successful, otherwise None.
        """
        with self.lock:
            return self._takeReading()

    def update_rotation_vector(self, data):
        with self.lock:
            self.rotation_vector = data

    def update_orientation(self, data):
        with self.lock:
            self.orientation = data

    def update_gravity(self, data):
        with self.lock:
            self.gravity = data

    def update_linear_acceleration(self, data):
        with self.lock:
            self.linear_acceleration = data

    def update_gyroscope(self, data):
        with self.lock:
            self.gyroscope = data

    def get_rotation_vector(self):
        return self.rotation_vector

    def get_orientation(self):
        return self.orientation

    def get_gravity(self):
        return self.gravity

    def get_linear_acceleration(self):
        return self.linear_acceleration

    def get_gyroscope(self):
        return self.gyroscope

    def parse_data(self, line):
        parts = line.split(', ')
        if len(parts) >= 2:
            sensor_type = parts[1]

            # Convert string values to numbers
            values = [float(value) for value in parts[2:]]

            if sensor_type == 'rotation vector':
                self.update_rotation_vector(values)
            elif sensor_type == 'Orientation':
                self.update_orientation(values)
            elif sensor_type == 'gravity':
                self.update_gravity(values)
            elif sensor_type == 'linear acceleration':
                self.update_linear_acceleration(values)
            elif sensor_type == 'gyroscope':
                self.update_gyroscope(values)
        else:
            log.warning("The string does not have enough parts to decode")

    def read_imu_data(self):
        if not self.is_setup:
            self._setup()
        while True:
            try:
                line = self.sensor.readline().decode().strip()
                self.parse_data(line)
            except Exception as e:
                log.warning("Error reading from serial port:", e)
                # Handle errors such as port disconnection here
                # For simplicity, I'm just printing the error

    def startCalibration(self):
        self.calibration_state = CalibrationState.IN_PROGRESS
        self.calibration_good_at = None
        # Reset saved calibration by stopping and starting autocal per documentation
        # Stop auto-calibration
        self.write_to_naviguider(NaviguiderCommands.STOP_AUTOCAL.value)
        # Start auto-calibration
        self.write_to_naviguider(NaviguiderCommands.START_AUTOCAL.value)

    def checkCalibration(self):
        if time.time() - self.check_calibration_time >= self.wait_to_check_calibration_duration:
            logging.debug("Checking Calibration")
            try:
                # set the calibration status to save when we are not querying a 
                # new calibration status
                self.calibration_status = self.sensor.calibration_status

                if self.calibration_state == CalibrationState.IN_PROGRESS:
                    logging.debug("Calibrating imu")
                    if not self.calibration_good_at and self.calibration_status < self.calibration_acceptable:
                        self.calibration_good_at = time.monotonic()
                        logging.debug("Record time of good calibration")
                    if self.calibration_good_at and (time.monotonic() - self.calibration_good_at > self.calibration_acceptable_time):
                        logging.debug("Good calibration has been achieved for over 5 seconds, saving calibration data")
                        # Save calibration
                        self.write_to_naviguider(NaviguiderCommands.SAVE_CALIBRATION.value)
                        self.calibration_good_at = None
                        self.calibration_state = CalibrationState.COMPLETE
            except Exception as error:
                log.warning("Error trying to get calibration status!")
            # reset the start time
            self.check_calibration_time = time.time()
        else:
            logging.debug("Waiting To Check Calibration")

    def write_to_naviguider(self, command):
        self.sensor.write(command)
        sleep(0.1)

    def configure_imu(self):
        try:
            # IMU mount position
            self.write_to_naviguider(NaviguiderCommands.MOUNT_Z_DOWN_180.value)
            # Set NED orientation mode
            self.write_to_naviguider(NaviguiderCommands.NED_MODE.value)
            # Configure the IMU to send updates at specific rates for sensor IDs
            # Orientation 5 Hz
            self.write_to_naviguider(NaviguiderCommands.ORIENTATION_5Hz.value)
            # Gyroscope 5 Hz
            self.write_to_naviguider(NaviguiderCommands.GYROSCOPE_5Hz.value)
            # Gravity 5 Hz
            self.write_to_naviguider(NaviguiderCommands.GRAVITY_5Hz.value)
            # Linear Acceleration 5 Hz
            self.write_to_naviguider(NaviguiderCommands.LINEAR_ACCELERATION_5Hz.value)
            # Rotation Vector (Quaternions) 5 Hz
            self.write_to_naviguider(NaviguiderCommands.ROTATION_VECTOR_5Hz.value)
            # Turn off meta data
            self.write_to_naviguider(NaviguiderCommands.META_OFF.value)
        except Exception as e:
            log.warning("Error configuring IMU:", e)