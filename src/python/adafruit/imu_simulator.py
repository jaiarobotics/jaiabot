from imu import *

import datetime

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

            return IMUReading(orientation=None, 
                            linear_acceleration=linear_acceleration,
                            linear_acceleration_world=linear_acceleration_world,
                            gravity=Vector3(0.03, 0.03, 9.8), # We need to use 0.03, to avoid looking like a common glitch that gets filtered
                            calibration_state=CalibrationState.COMPLETE,
                            calibration_status=0,
                            quaternion=quaternion,
                            angular_velocity=Vector3(0, 0, 0))
