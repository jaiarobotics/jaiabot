from dataclasses import dataclass
from enum import Enum
from orientation import Orientation
from vector3 import Vector3
from typing import *
from quaternion import Quaternion
import logging
from math import *
from jaiabot.messages.imu_pb2 import IMUData

from threading import *

logging.basicConfig(format='%(asctime)s %(levelname)10s %(message)s')
log = logging.getLogger('imu')

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
        if reading.orientation is not None:
            imu_data.euler_angles.heading = reading.orientation.heading
            imu_data.euler_angles.pitch = reading.orientation.pitch
            imu_data.euler_angles.roll = reading.orientation.roll
            # check if the bot rolled over
            bot_rolled = int(abs(reading.orientation.roll) > 90)
            imu_data.bot_rolled_over = bot_rolled
        else:
            imu_data.bot_rolled_over = False

        imu_data.linear_acceleration.x = reading.linear_acceleration.x
        imu_data.linear_acceleration.y = reading.linear_acceleration.y
        imu_data.linear_acceleration.z = reading.linear_acceleration.z

        imu_data.gravity.x = reading.gravity.x
        imu_data.gravity.y = reading.gravity.y
        imu_data.gravity.z = reading.gravity.z

        angular_velocity = reading.angular_velocity
        if angular_velocity is not None:
            imu_data.angular_velocity.x = angular_velocity.x
            imu_data.angular_velocity.y = angular_velocity.y
            imu_data.angular_velocity.z = angular_velocity.z

        imu_data.quaternion.w = reading.quaternion.w
        imu_data.quaternion.x = reading.quaternion.x
        imu_data.quaternion.y = reading.quaternion.y
        imu_data.quaternion.z = reading.quaternion.z

        if reading.calibration_status is not None:
            # only send the mag cal
            imu_data.calibration_status = reading.calibration_status

        if reading.calibration_state is not None:
            # .value converts enum type to int (which the protobuf side is looking for)
            imu_data.calibration_state = reading.calibration_state.value


        return imu_data
    
    def startCalibration(self):
        pass
