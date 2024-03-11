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
from jaiabot.messages.imu_pb2 import IMUData

from pyjaia.series import *
from processing import *
from filters import *

import csv

log = logging.getLogger('jaiabot_imu')


def magnitude(v):
    return sqrt(v.x * v.x + v.y * v.y + v.z * v.z)


class Analyzer:
    linear_acceleration_x = Series('acc.x')
    linear_acceleration_y = Series('acc.y')
    linear_acceleration_z = Series('acc.z')

    gravity_x = Series('g.x')
    gravity_y = Series('g.y')
    gravity_z = Series('g.z')

    max_acceleration_magnitude = 0.0

    sample_interval: float

    # Whether to dump the raw data to a file when significant wave height is calculated
    # (for debugging)
    dump_to_file_flag: bool

    _thread: Thread
    _sampling_for_wave_height = False
    _sampling_for_bottom_characterization = False
    _lock = Lock()


    def __init__(self, imu: IMU, sample_frequency: float, dump_to_file_flag: bool=False):
        log.info(f'Analyzer sampling rate: {sample_frequency} Hz')

        self.sample_interval = 1 / sample_frequency

        self.dump_to_file_flag = dump_to_file_flag

    def addIMUData(self, imuData: any):
        if imuData is None:
            return
        
        if self._sampling_for_wave_height:
            utime = datetime.utcnow().timestamp() * 1e6
            acc = imuData.linear_acceleration

            self.linear_acceleration_x.append(utime, acc.x)
            self.linear_acceleration_y.append(utime, acc.y)
            self.linear_acceleration_z.append(utime, acc.z)

            self.gravity_x.append(utime, imuData.gravity.x)
            self.gravity_y.append(utime, imuData.gravity.y)
            self.gravity_z.append(utime, imuData.gravity.z)

        if self._sampling_for_bottom_characterization:
            acceleration_magnitude = magnitude(acc)
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
            if self.dump_to_file_flag:
                self.dumpToFile()

            self.clearAccelerationSeries()
            self._sampling_for_wave_height = False

    def getSignificantWaveHeight(self):
        with self._lock:
            swh = calculateSignificantWaveHeight(self.linear_acceleration_x, self.linear_acceleration_y, self.linear_acceleration_z, self.gravity_x, self.gravity_y, self.gravity_z, 1.0 / self.sample_interval)
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

    def dumpToFile(self):
        date_string = datetime.now().isoformat()
        csv_filename = os.path.expanduser(f'/var/log/jaiabot/swh-debug-{date_string}.csv')
        with open(csv_filename, 'w') as csv_file:
            csv_writer = csv.writer(csv_file)
            for i in range(len(self.linear_acceleration_x.utime)):
                line = [
                    self.linear_acceleration_x.utime[i],
                    self.linear_acceleration_x.y_values[i],
                    self.linear_acceleration_y.y_values[i],
                    self.linear_acceleration_z.y_values[i],
                    self.gravity_x.y_values[i],
                    self.gravity_y.y_values[i],
                    self.gravity_z.y_values[i]
                ]
                csv_writer.writerow(line)


def calculateSignificantWaveHeight(acc_x: Series, acc_y: Series, acc_z: Series, g_x: Series, g_y: Series, g_z: Series, sampleFreq: float):
    # Get the vertical acceleration series
    acc_vertical = Series()
    acc_vertical.name = 'acc_vertical'
    acc_vertical.utime = acc_x.utime

    for i in range(len(acc_x.utime)):
        acc_vertical.y_values.append((acc_x.y_values[i] * g_x.y_values[i] + 
                                      acc_y.y_values[i] * g_y.y_values[i] + 
                                      acc_z.y_values[i] * g_z.y_values[i]) / 9.8)
        
    # Get a uniformly-sampled series (for our FFT)
    uniformVerticalAcceleration = acc_vertical.makeUniform(freq=sampleFreq)

    elevation = calculateElevationSeries(uniformVerticalAcceleration, sampleFreq)
    waveHeights = calculateSortedWaveHeights(elevation)
    swh = significantWaveHeight(waveHeights)

    return swh


if __name__ == '__main__':
    # imu = Simulator(wave_frequency=0.33, wave_height=0.35)
    # analyzer = Analyzer(imu=imu, sample_frequency=4)

    # analyzer.startSamplingForWaveHeight()

    # while True:
    #     print(analyzer.getSignificantWaveHeight())
    #     sleep(1)
    import sys
    import h5py
    from seriesSet import SeriesSet
    from analyze import shouldInclude

    analyzer = Analyzer(imu=None, sample_frequency=4)

    for h5Path in sys.argv[1:]:
        h5File = h5py.File(h5Path)
        print()
        print(h5File.filename)

        seriesSet = SeriesSet.loadFromH5File(h5File)
        drifts = seriesSet.split(shouldInclude)

        for drift in drifts:
            analyzer.linear_acceleration_x = drift.acc_x
            analyzer.linear_acceleration_y = drift.acc_y
            analyzer.linear_acceleration_z = drift.acc_z
            analyzer.gravity_x = drift.grav_x
            analyzer.gravity_y = drift.grav_y
            analyzer.gravity_z = drift.grav_z

            print('Significant wave height = ', analyzer.getSignificantWaveHeight())
