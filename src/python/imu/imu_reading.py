# Standard modules
from enum import Enum
from dataclasses import *
from typing import Optional
from math import *

# Jaia modules
from orientation import Orientation
from vector3 import Vector3
from quaternion import Quaternion
from magnetometer import RawMagnetometer
from jaiabot.messages.imu_pb2 import IMUData


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
    angular_velocity: Vector3
    raw_magnetometer: Optional[RawMagnetometer] = field(default=None)
    magnetometer_accuracy: int
    gyroscope_accuracy: int
    accelerometer_accuracy: int

    def convertToIMUData(self):
        """Returns an IMUData protobuf object, suitable for sending over UDP

        Returns:
            IMUData: the reading as an IMUData
        """
        imu_data = IMUData()
        if self.orientation is not None:
            imu_data.euler_angles.heading = self.orientation.heading
            imu_data.euler_angles.pitch = self.orientation.pitch
            imu_data.euler_angles.roll = self.orientation.roll
            # check if the bot rolled over
            imu_data.bot_rolled_over = int(abs(self.orientation.roll) > 90)
        else:
            imu_data.bot_rolled_over = False

        if self.linear_acceleration is not None:
            imu_data.linear_acceleration.x = self.linear_acceleration.x
            imu_data.linear_acceleration.y = self.linear_acceleration.y
            imu_data.linear_acceleration.z = self.linear_acceleration.z

        if self.gravity is not None:
            imu_data.gravity.x = self.gravity.x
            imu_data.gravity.y = self.gravity.y
            imu_data.gravity.z = self.gravity.z

        if self.angular_velocity is not None:
            imu_data.angular_velocity.x = self.angular_velocity.x
            imu_data.angular_velocity.y = self.angular_velocity.y
            imu_data.angular_velocity.z = self.angular_velocity.z

        if self.quaternion is not None:
            imu_data.quaternion.w = self.quaternion.w
            imu_data.quaternion.x = self.quaternion.x
            imu_data.quaternion.y = self.quaternion.y
            imu_data.quaternion.z = self.quaternion.z

        if self.calibration_status is not None:
            # only send the mag cal
            imu_data.calibration_status = self.calibration_status

        if self.calibration_state is not None:
            # .value converts enum type to int (which the protobuf side is looking for)
            imu_data.calibration_state = self.calibration_state.value

        if self.raw_magnetometer is not None:
            imu_data.raw_magnetometer.x = self.raw_magnetometer.x
            imu_data.raw_magnetometer.y = self.raw_magnetometer.y
            imu_data.raw_magnetometer.z = self.raw_magnetometer.z
            imu_data.raw_magnetometer.heading = self.raw_magnetometer.heading

        if self.magnetometer_accuracy is not None:
            imu_data.magnetometer_accuracy = self.magnetometer_accuracy
        
        if self.gyroscope_accuracy is not None:
            imu_data.gyroscope_accuracy = self.gyroscope_accuracy

        if self.accelerometer_accuracy is not None:
            imu_data.accelerometer_accuracy = self.accelerometer_accuracy

        return imu_data
