from imu import *

import serial
from time import sleep
from threading import Lock

class Naviguider(IMU):
    def __init__(self):
        self.rotation_vector = None
        self.orientation = None
        self.gravity = None
        self.linear_acceleration = None
        self.gyroscope = None
        self.is_setup = False
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

    def configure_imu(self):
        try:
            # IMU mount position
            self.sensor.write(b'M15\r')
            sleep(0.1)
            # Set NED orientation mode
            self.sensor.write(b'J3')
            sleep(0.1)
            # Configure the IMU to send updates at specific rates for sensor IDs
            # Orientation 5 Hz
            self.sensor.write(b's 3,5\r')
            sleep(0.1)
            # Gyroscope 5 Hz
            self.sensor.write(b's 4,5\r')
            sleep(0.1)
            # Gravity 5 Hz
            self.sensor.write(b's 9,5\r')
            sleep(0.1)
            # Linear Acceleration 5 Hz
            self.sensor.write(b's 10,5\r')
            sleep(0.1)
            # Rotation Vector (Quaternions) 5 Hz
            self.sensor.write(b's 11,5\r')
            sleep(0.1)
            # Turn off meta data
            self.sensor.write(b'm0')
            sleep(0.1)
        except Exception as e:
            log.warning("Error configuring IMU:", e)