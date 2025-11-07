# Standard modules
from enum import Enum
from dataclasses import *
from math import *

# Jaia modules
from orientation import Orientation
from vector3 import Vector3
from quaternion import Quaternion
from jaiabot.messages.imu_pb2 import IMUData


@dataclass
class Accuracies:
    # These range from 0 (inaccurate) to 3 (very accurate)
    magnetometer: int
    gyroscope: int
    accelerometer: int


class CalibrationState(Enum):
    IN_PROGRESS = 1
    COMPLETE = 2

@dataclass
class IMUReading:
    orientation: Orientation = None
    linear_acceleration: Vector3 = None
    linear_acceleration_world: Vector3 = None
    gravity: Vector3 = None
    accuracies: Accuracies = None
    calibration_state: CalibrationState = None
    quaternion: Quaternion = None
    angular_velocity: Vector3 = None
    magnetic_field: Vector3 = None
    acceleration: Vector3 = None


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

        def copy_wxyz(src: Vector3 | Quaternion, dest: any):
            if src is None:
                return
            try:
                dest.w = src.w
            except AttributeError:
                pass
            dest.x = src.x
            dest.y = src.y
            dest.z = src.z

        # Raw-ish values
        copy_wxyz(self.magnetic_field, imu_data.magnetic_field)
        copy_wxyz(self.acceleration, imu_data.acceleration)
        copy_wxyz(self.angular_velocity, imu_data.angular_velocity)

        # Computed by IMU hardware
        copy_wxyz(self.linear_acceleration, imu_data.linear_acceleration)
        copy_wxyz(self.gravity, imu_data.gravity)
        copy_wxyz(self.quaternion, imu_data.quaternion)

        # Computed by using the quaternion on linear_acceleration
        copy_wxyz(self.linear_acceleration_world, imu_data.linear_acceleration_world)


        if self.accuracies is not None:
            imu_data.accuracies.gyroscope = self.accuracies.gyroscope
            imu_data.accuracies.accelerometer = self.accuracies.accelerometer
            imu_data.accuracies.magnetometer = self.accuracies.magnetometer

        if self.calibration_state is not None:
            # .value converts enum type to int (which the protobuf side is looking for)
            imu_data.calibration_state = self.calibration_state.value

        return imu_data
