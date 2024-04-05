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
import serial
import time
from threading import *
import threading

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('imu')

try:
    uart = serial.Serial("/dev/ttyUSB0", 115200)
    physical_device_available = True
except Exception as e:
    log.warning(f'Physical device not available: {e}')
    physical_device_available = False

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

        print(reading.orientation)

        imu_data.euler_angles.heading = reading.orientation[0]
        imu_data.euler_angles.pitch = reading.orientation[1]
        imu_data.euler_angles.roll = reading.orientation[2]

        imu_data.linear_acceleration.x = reading.linear_acceleration.x
        imu_data.linear_acceleration.y = reading.linear_acceleration.y
        imu_data.linear_acceleration.z = reading.linear_acceleration.z

        imu_data.gravity.x = reading.gravity.x
        imu_data.gravity.y = reading.gravity.y
        imu_data.gravity.z = reading.gravity.z

        if reading.calibration_status is not None:
            # only send the mag cal
            imu_data.calibration_status = int(reading.calibration_status)

        # check if the bot rolled over
        bot_rolled = int(abs(reading.orientation[2]) > 90)
        imu_data.bot_rolled_over = bot_rolled

        return imu_data

class Naviguider(IMU):
    def __init__(self):
        self.rotation_vector = None
        self.orientation = None
        self.gravity = None
        self.linear_acceleration = None
        self.gyroscope = None
        self.is_setup = False
        self.lock = threading.Lock()

    def _setup(self):
        """Thread unsafe setup function.  Only used internally."""
        if not self.is_setup:
            try:
                log.warning('We are not setup')

                self.sensor = uart

                log.info('Connected, now lets enable output')

                self.configure_imu()
          
                self.is_setup = True

            except Exception as error:
                self.is_setup = False
                log.warning("Error trying to setup driver!")
            
    def setup(self):
        """Thread-safe setup function.  Call to setup the IMU."""
        with self.lock:
            self._setup()

    def _takeReading(self):
        """Thread unsafe takeReading function.  Only used internally."""
        if not self.is_setup:
            self._setup()

        try:
            quat_x, quat_y, quat_z, quat_w, quat_accuracy = self.get_rotation_vector()
            quaternion = (quat_w, quat_x, quat_y, quat_z)
            (accel_x, accel_y, accel_z, accel_accuracy) = self.get_linear_acceleration()
            linear_acceleration = (accel_x, accel_y, accel_z)
            (gravity_x, gravity_y, gravity_z, gravity_accuracy) = self.get_gravity()
            gravity = (gravity_x, gravity_y, gravity_z)
            (yaw, pitch, roll, calibration_status) = self.get_orientation()
           
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
            orientation = (yaw, pitch, roll)

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

    def read_imu_data(self):
        if not self.is_setup:
            self._setup()
        while True:
            try:
                #print("Hello")
                line = self.sensor.readline().decode().strip()
                #print(line)
                self.parse_data(line)
            except Exception as e:
                print("Error reading from serial port:", e)
                # Handle errors such as port disconnection here
                # For simplicity, I'm just printing the error

    def configure_imu(self):
        try:
            # Configure the IMU to send updates at specific rates for sensor IDs
            # Orientation
            self.sensor.write(b's 3,5\r')
            # Gyroscope
            self.sensor.write(b's 4,5\r')
            # Gravity
            self.sensor.write(b's 9,5\r')
            # Linear Acceleration
            self.sensor.write(b's 10,5\r')
            # Rotation Vector (Quaternions)
            self.sensor.write(b's 11,5\r')
            # Turn off meta data
            self.sensor.write(b'm0')
        except Exception as e:
            print("Error configuring IMU:", e)

class Simulator(IMU):
    wave_frequency: float
    wave_height: float

    _lock: Lock

    def __init__(self, wave_frequency: float=1, wave_height: float=1):
        log.info('Device: Simulator')

        self.wave_frequency = wave_frequency
        self.wave_height = wave_height
        self._lock = Lock()

    def _setup(self):
        pass

    def setup(self):
        with self._lock:
            self._setup()

    def takeReading(self) -> IMUReading:
        with self._lock:
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
