# Standard modules
from typing import *
import logging

# Jaia modules
from imu_reading import *


log = logging.getLogger('imu')


class IMU:
    def setup(self):
        pass

    def takeReading(self):
        return IMUReading()

    def startCalibration(self):
        pass
