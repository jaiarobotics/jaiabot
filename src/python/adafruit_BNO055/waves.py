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


def remove_linear_component(values: Iterable):
    '''Fit data to a line, and subtract the line to remove any linear trending'''
    indices = numpy.arange(0, len(values))
    A = numpy.vstack([indices, numpy.ones(len(indices))]).T
    m, c = lstsq(A, values, rcond=None)[0]

    newValues = []
    for i, value in enumerate(values):
        newValues.append(value - i * m)
    return newValues


class TimeSeries:
    dt: float
    values: List[float]

    def __init__(self, dt: float, values: List[float]) -> None:
        self.dt = dt
        self.values = values

    def plot(self):
        x = numpy.arange(0, len(self.values) * self.dt, self.dt)
        fig = px.line(x=x, y=self.values)
        fig.show()

    def get_heights_from_accelerations(self):
        speed = 0
        height = 0
        heights = []

        for value in self.values:
            speed += value * self.dt
            height += speed * self.dt
            heights.append(height)

        # Eliminate any constant speed
        heights = remove_linear_component(heights)

        integral = TimeSeries(dt=self.dt, values=heights)
        return integral

    def significant_wave_height(self):
        if len(self.values) <= 1:
            return 0

        # Significant wave height is defined as 4 times standard deviation
        return 4 * float(std(self.values))


class Analyzer:
    '''
        This class ingests a series of accelerations, and returns:
        a) the primary wave height amplitude and frequency
        b) the maximum acceleration (for bottom type characterization)
    '''

    acceleration_z: TimeSeries
    acceleration_mag: TimeSeries

    imu: IMU
    max_points = 100
    dt: float

    _thread: Thread
    _lock: Lock

    def __init__(self, imu: IMU, max_points: int, dt: float) -> None:
        self.imu = imu
        self.max_points = max_points
        self.dt = dt
        self.acceleration_z = TimeSeries(dt=dt, values=[])
        self.acceleration_mag = TimeSeries(dt=dt, values=[])

        self._lock = Lock()


    def start(self):
        def do_wave_analysis():
            while True:
                sleep(self.dt)
                reading = self.imu.getData()
                if reading is not None:
                    self.addAcceleration(reading.linear_acceleration_world)

        self._thread = Thread(target=do_wave_analysis)
        self._thread.daemon = True
        self._thread.start()


    def addAcceleration(self, acceleration: Vector3):

        with self._lock:
            self.acceleration_z.values.append(acceleration.z)
            self.acceleration_mag.values.append(acceleration.magnitude())

            if len(self.acceleration_z.values) > self.max_points:
                self.acceleration_z.values.pop(0)
                self.acceleration_mag.values.pop(0)


    def significantWaveHeight(self):

        with self._lock:
            acceleration_z = deepcopy(self.acceleration_z)

        return acceleration_z.get_heights_from_accelerations().significant_wave_height()


    def maxAcceleration(self) -> float:
        '''Return the maximum acceleration amplitude acheived in the sample window'''

        with self._lock:
            if len(self.acceleration_mag.values) < 1:
                return 0

            return max(self.acceleration_mag.values)


    def debug(self):

        with self._lock:
            acceleration_z = deepcopy(self.acceleration_z)

        acceleration_z.plot()
        acceleration_z.get_heights_from_accelerations().plot()

        print(self.significantWaveHeight())


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

    x = accelerations.get_heights_from_accelerations()
    x.plot()

    print(x.significant_wave_height())
