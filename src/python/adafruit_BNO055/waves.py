from dataclasses import dataclass
from math import *
from typing import *
from scipy.fft import dct, idct
from numpy import std
import numpy
from vector3 import Vector3
import plotly.express as px
from imu import *
from threading import Thread, Lock
from time import sleep
from copy import deepcopy
from numpy.linalg import lstsq
import logging

from series import *
from processing import *
from filters import *

log = logging.getLogger('jaiabot_imu')


class Analyzer:
    linear_acceleration_x = Series('acc.x')
    linear_acceleration_y = Series('acc.y')
    linear_acceleration_z = Series('acc.z')

    gravity_x = Series('g.x')
    gravity_y = Series('g.y')
    gravity_z = Series('g.z')

    max_acceleration_magnitude = 0.0

    imu: IMU
    sample_interval: float

    _thread: Thread
    _sampling_for_wave_height = False
    _sampling_for_bottom_characterization = False
    _lock = Lock()


    def __init__(self, imu: IMU, sample_frequency: float):
        log.info(f'Analyzer sampling rate: {sample_frequency} Hz')

        self.sample_interval = 1 / sample_frequency

        self.imu = imu

        def run():
            self._sampleLoop()

        self._thread = Thread(target=run, name='acceleration-sampler')
        self._thread.daemon = True
        self._thread.start()

    def _sampleLoop(self):
        dt = self.sample_interval

        while True:
            sleep(dt)

            with self._lock:

                if self._sampling_for_wave_height or self._sampling_for_bottom_characterization:
                    reading = self.imu.takeReading()

                    if reading is not None:
                        if self._sampling_for_wave_height:
                            utime = datetime.utcnow().timestamp() * 1e6

                            self.linear_acceleration_x.append(utime, reading.linear_acceleration.x)
                            self.linear_acceleration_y.append(utime, reading.linear_acceleration.y)
                            self.linear_acceleration_z.append(utime, reading.linear_acceleration.z)

                            self.gravity_x.append(utime, reading.gravity.x)
                            self.gravity_y.append(utime, reading.gravity.y)
                            self.gravity_z.append(utime, reading.gravity.z)

                        if self._sampling_for_bottom_characterization:
                            acceleration_magnitude = reading.linear_acceleration.magnitude()
                            self.max_acceleration_magnitude = max(acceleration_magnitude, self.max_acceleration_magnitude)

    # Wave Height
    def clearAccelerationSeries(self):
        self.linear_acceleration_x.clear()
        self.linear_acceleration_y.clear()
        self.linear_acceleration_z.clear()

        self.gravity_x.clear()
        self.gravity_y.clear()
        self.gravity_z.clear()


    def startSamplingForWaveHeight(self):
        with self._lock:
            self.clearAccelerationSeries()
            self._sampling_for_wave_height = True

    def stopSamplingForWaveHeight(self):
        with self._lock:
            self.clearAccelerationSeries()
            self._sampling_for_wave_height = False

    def getSignificantWaveHeight(self):
        with self._lock:
            swh = calculateSignificantWaveHeight(self.linear_acceleration_x, self.linear_acceleration_y, self.linear_acceleration_z, self.gravity_x, self.gravity_y, self.gravity_z)
        return swh

    # Bottom characterization
    def startSamplingForBottomCharacterization(self):
        with self._lock:
            self.max_acceleration_magnitude = 0
            self._sampling_for_bottom_characterization = True

    def stopSamplingForBottomCharacterization(self):
        with self._lock:
            self.max_acceleration_magnitude = 0
            self._sampling_for_bottom_characterization = False

    def getMaximumAcceleration(self):
        with self._lock:
            return self.max_acceleration_magnitude

    def debug(self):
        print(self.getSignificantWaveHeight())


def calculateSignificantWaveHeight(acc_x: Series, acc_y: Series, acc_z: Series, g_x: Series, g_y: Series, g_z: Series):
    # Filter out glitches from the IMU
    acc_x = filterAcc(acc_x)
    acc_y = filterAcc(acc_y)
    acc_z = filterAcc(acc_z)

    g_x = filterAcc(g_x)
    g_y = filterAcc(g_y)
    g_z = filterAcc(g_z)

    

    return 0


if __name__ == '__main__':
    imu = Simulator(wave_frequency=0.33, wave_height=0.35)
    analyzer = Analyzer(imu=imu, sample_frequency=5)

    analyzer.startSamplingForWaveHeight()

    while True:
        print(analyzer.getSignificantWaveHeight())
        sleep(1)
