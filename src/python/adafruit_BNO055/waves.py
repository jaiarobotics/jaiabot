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
    acceleration_world_z: Series
    acceleration_mag: TimeSeries

    imu: IMU
    max_points = 1000
    sample_interval: float

    _thread: Thread
    _sampling_for_wave_height = False
    _sampling_for_bottom_characterization = False
    _lock = Lock()
    _processToElevationSteps: List[ProcessingStep]

    def __init__(self, imu: IMU, sample_frequency: float):
        log.info(f'Analyzer sampling rate: {sample_frequency} Hz')

        self.sample_interval = 1 / sample_frequency
        self.acceleration_world_z = Series()
        self.acceleration_mag = TimeSeries(dt=self.sample_interval)
        self.imu = imu

        # PROCESSING STEPS
        self._processToElevationSteps = [
            sliceSeries(10e6),
            getUniformSeries(freq=sample_frequency),
            accelerationToElevation(sampleFreq=sample_frequency, filterFunc=brickWallFilter(0.2, 2.0)),
        ]

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
                            self.acceleration_world_z.utime.append(utime)
                            self.acceleration_world_z.y_values.append(reading.linear_acceleration_world.z)

                        if self._sampling_for_bottom_characterization:
                            self.acceleration_mag.pushValue(reading.linear_acceleration_world.magnitude())

    # Wave Height
    def startSamplingForWaveHeight(self):
        with self._lock:
            self.acceleration_world_z.clear()
            self._sampling_for_wave_height = True

    def stopSamplingForWaveHeight(self):
        with self._lock:
            self.acceleration_world_z.clear()
            self._sampling_for_wave_height = False

    def getSignificantWaveHeight(self):
        with self._lock:
            elevationSeries = processSeries(self.acceleration_world_z, self._processToElevationSteps)
            waveHeights = elevationSeries.sortedWaveHeights()
            swh = significantWaveHeight(waveHeights)
        
        return swh

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
            if len(self.acceleration_mag._values) > 0:
                maxAcceleration = max(self.acceleration_mag._values)
            else:
                maxAcceleration = 0.0
        
        return maxAcceleration

    def debug(self):

        with self._lock:
            acceleration_z = deepcopy(self.acceleration_z)

        print(self.getSignificantWaveHeight())


if __name__ == '__main__':
    def filterAcc(series: Series):
        newSeries = deepcopy(series)
        newSeries.y_values = list(newSeries.y_values) # In case it's a tuple

        for i in range(2, len(series.utime) - 2 - 1):
            proj_y = newSeries.y_values[i - 1]
            y = newSeries.y_values[i]

            if abs(y) > 50:
                y = proj_y

            newSeries.y_values[i] = y
            
        return newSeries

    imu = Simulator(wave_frequency=0.33, wave_height=0.35)
    analyzer = Analyzer(imu=imu, sample_frequency=5)

    analyzer.startSamplingForWaveHeight()

    while True:
        print(analyzer.getSignificantWaveHeight())
        sleep(1)
