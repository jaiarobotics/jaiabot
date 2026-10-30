# Standard modules
from typing import *
import logging

# Jaia modules
from imu_reading import *


class IMU:
    # True if the sensor streams readings on its own clock.  Then the driver sends each new reading
    # from waitForReading() as it arrives, instead of polling takeReading() on a timer.
    is_event_driven = False

    def setup(self):
        pass

    def takeReading(self):
        return IMUReading()

    def waitForReading(self, timeout: float):
        raise NotImplementedError

    def setRate(self, rate_hz: float):
        pass

    def startCalibration(self):
        pass
