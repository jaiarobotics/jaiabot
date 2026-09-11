from imu import *
from threading import Lock

import goby

imu_log = logging.getLogger('imu.simulator')

class Simulator(IMU):
    wave_frequency: float
    wave_height: float

    _lock: Lock

    def __init__(self, wave_frequency: float=1, wave_height: float=1):
        imu_log.info('Device: Simulator')

        self.wave_frequency = wave_frequency
        self.wave_height = wave_height
        self._pitch = 0.0
        self._roll = 0.0
        self._lock = Lock()

    def update(self, env):
        """Follow the simulated vehicle's attitude; the wave motion is generated here."""
        with self._lock:
            if env.HasField('pitch'):
                self._pitch = env.pitch
            if env.HasField('roll'):
                self._roll = env.roll

    def _setup(self):
        pass

    def setup(self):
        with self._lock:
            self._setup()

    def takeReading(self) -> IMUReading:
        with self._lock:
            # the simulated clock, so the wave keeps its period under time warp
            t = goby.time.now()
            a_z = self.wave_height * 0.5 * sin(t * 2 * pi * self.wave_frequency) * (2 * pi * self.wave_frequency) ** 2
            linear_acceleration = Vector3(0, 0, a_z)

            quaternion = Quaternion(1, 0, 0, 0)
            linear_acceleration_world = quaternion.apply(linear_acceleration)

            return IMUReading(orientation=Orientation(heading=0,
                                                      pitch=degrees(self._pitch),
                                                      roll=degrees(self._roll)),
                            linear_acceleration=linear_acceleration,
                            linear_acceleration_world=linear_acceleration_world,
                            gravity=Vector3(0.03, 0.03, 9.8), # We need to use 0.03, to avoid looking like a common glitch that gets filtered
                            calibration_state=CalibrationState.COMPLETE,
                            accuracies=Accuracies(magnetometer=3, gyroscope=3, accelerometer=3),
                            quaternion=quaternion,
                            angular_velocity=Vector3(0, 0, 0))
