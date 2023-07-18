from dataclasses import dataclass
from math import *
from typing import *
from scipy.fft import dct, idct
from numpy import std
import numpy
from vector3 import Vector3
import plotly.express as px
from imu import IMU
from threading import Thread, Lock
from time import sleep
from copy import deepcopy
from numpy.linalg import lstsq
import logging

log = logging.getLogger('jaiabot_imu')


def filter_quadratic(values: Iterable):
    '''Fit data to a quadratic, and subtract it to remove any drift due to constant acceleration error'''
    indices = numpy.arange(0, len(values))
    A = numpy.vstack([indices*indices, indices, numpy.ones(len(indices))]).T
    a, b, c = lstsq(A, values, rcond=None)[0]

    newValues = []
    for i, value in enumerate(values):
        correction = a*i*i + b*i + c
        newValues.append(value - correction)
    return newValues


def plotValues(values: Iterable[float], dt: float = 1.0):
    x = numpy.arange(0, len(values) * dt, dt)
    fig = px.line(x=x, y=values)
    fig.show()


class TimeSeries:
    dt: float
    max_value_count: float
    _values: List[float]

    def __init__(self, dt: float, values: List[float] = [], max_value_count=1000) -> None:
        self.dt = dt
        self._values = deepcopy(values)
        self.max_value_count = max_value_count

    def pushValue(self, value: float):
        self._values.append(value)

        if len(self._values) > self.max_value_count:
            self._values.pop(0)

    def clear(self):
        self._values.clear()

    def plot(self):
        plotValues(self._values, self.dt)

    def getHeightsFromAccelerations(self):
        speed = 0
        height = 0
        heights = []

        accelerations = self._values

        for accel in accelerations:
            speed += accel * self.dt
            height += speed * self.dt
            heights.append(height)

        # Eliminate any constant speed
        heights = filter_quadratic(heights)

        integral = TimeSeries(dt=self.dt, values=heights)
        return integral

    def significantWaveHeight(self):
        if len(self._values) <= 1:
            return 0

        # Significant wave height is defined as 4 times standard deviation
        return 4 * float(std(self._values))


class Analyzer:
    acceleration_z: TimeSeries
    acceleration_mag: TimeSeries

    imu: IMU
    max_points = 1000
    sample_interval: float

    _thread: Thread
    _sampling_for_wave_height = False
    _sampling_for_bottom_characterization = False
    _lock = Lock()

    def __init__(self, imu: IMU, sample_frequency: float):
        log.info(f'Analyzer sampling rate: {sample_frequency} Hz')

        self.sample_interval = 1 / sample_frequency
        self.acceleration_z = TimeSeries(dt=self.sample_interval)
        self.acceleration_mag = TimeSeries(dt=self.sample_interval)
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
                            self.acceleration_z.pushValue(reading.linear_acceleration_world.z)

                        if self._sampling_for_bottom_characterization:
                            self.acceleration_mag.pushValue(reading.linear_acceleration_world.magnitude())

    # Wave Height
    def startSamplingForWaveHeight(self):
        with self._lock:
            self.acceleration_z.clear()
            self._sampling_for_wave_height = True

    def stopSamplingForWaveHeight(self):
        with self._lock:
            self.acceleration_z.clear()
            self._sampling_for_wave_height = False

    def getSignificantWaveHeight(self):
        with self._lock:
            significantWaveHeight = self.acceleration_z.getHeightsFromAccelerations().significantWaveHeight()
        
        return significantWaveHeight

    # Bottom characterization
    def startSamplingForBottomCharacterization(self):
        with self._lock:
            self.acceleration_mag.clear()
            self._sampling_for_bottom_characterization = True

    def stopSamplingForBottomCharacterization(self):
        with self._lock:
            self.acceleration_mag.clear()
            self._sampling_for_bottom_characterization = False

    def getMaximumAcceleration(self):
        with self._lock:
            maxAcceleration = max(self.acceleration_mag._values)
        
        return maxAcceleration

    def debug(self):

        with self._lock:
            acceleration_z = deepcopy(self.acceleration_z)

        acceleration_z.plot()
        acceleration_z.getHeightsFromAccelerations().plot()

        print(self.getSignificantWaveHeight())


if __name__ == '__main__':

    # Test accelerations
    AMPLITUDE = 1.5
    OFFSET = pi
    STEP = 0.1
    N = 500
    FREQ = 0.1

    accelerations = TimeSeries(STEP, numpy.array([AMPLITUDE * cos(2 * pi * i * STEP * FREQ + OFFSET) for i in range(0, N)]))
    accelerations.plot()

    ###

    x = accelerations.getHeightsFromAccelerations()
    x.plot()

    print(x.significantWaveHeight())
