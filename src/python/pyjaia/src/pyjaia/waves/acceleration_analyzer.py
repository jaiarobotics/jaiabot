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
from .analysis import doDriftAnalysis
from .types import DriftAnalysisConfig
from .processing import *
from .filters import *
from .analysis_html import *

import os

logger = logging.getLogger('jaiabot_imu')


def dotProduct(a, b):
    return a.x * b.x + \
           a.y * b.y + \
           a.z * b.z


def magnitude(v):
    return sqrt(v.x * v.x + v.y * v.y + v.z * v.z)


class AccelerationAnalyzer:
    config: DriftAnalysisConfig

    vertical_acceleration = Series('Raw Acceleration (m/s^2)')

    max_acceleration_magnitude = 0.0

    # Whether to dump the raw data to a file when significant wave height is calculated
    # (for debugging)
    dump_html_flag: bool

    _sampling_for_wave_height = False
    _sampling_for_bottom_characterization = False
    _lock = Lock()


    def __init__(self, config: DriftAnalysisConfig, dump_html_flag: bool=False):
        self.config = config

        logger.info(f'Analyzer sampling rate: {config.sampleFreq} Hz')

        self.dump_html_flag = dump_html_flag

    def addIMUData(self, imuData: any):
        if imuData is None:
            return
        
        acc = imuData.linear_acceleration
        
        if self._sampling_for_wave_height:
            utime = datetime.utcnow().timestamp() * 1e6
            vertical_acceleration = dotProduct(imuData.linear_acceleration, imuData.gravity) / magnitude(imuData.gravity)
            self.vertical_acceleration.append(utime, vertical_acceleration)

        if self._sampling_for_bottom_characterization:
            acceleration_magnitude = magnitude(acc)
            self.max_acceleration_magnitude = max(acceleration_magnitude, self.max_acceleration_magnitude)

    # Wave Height
    def clearAccelerationSeries(self):
        self.vertical_acceleration.clear()


    def startSamplingForWaveHeight(self):
        with self._lock:
            self.clearAccelerationSeries()
            self._sampling_for_wave_height = True

    def stopSamplingForWaveHeight(self):
        with self._lock:
            if self.dump_html_flag:
                self.dumpToFile()

            self.clearAccelerationSeries()
            self._sampling_for_wave_height = False

    def getDriftAnalysis(self):
        with self._lock:
            return doDriftAnalysis(self.vertical_acceleration, self.config)

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
        drift = doDriftAnalysis(self.vertical_acceleration, self.config)

        date_string = datetime.now().strftime('%Y%m%dT%H%M%S')
        filename = os.path.expanduser(f'/var/log/jaiabot/swh-debug-{date_string}.html')
        with open(filename, 'w') as html_file:
            html_file.write(htmlForDriftObject(drift))



if __name__ == '__main__':
    import sys
    import h5py
    from .series_set import *

    sampleFreq = 4.0

    config = DriftAnalysisConfig.default()

    analyzer = AccelerationAnalyzer(imu=None, config=config)

    for h5Path in sys.argv[1:]:
        h5File = h5py.File(h5Path)
        print()
        print(h5File.filename)

        seriesSet = SeriesSet.loadFromH5File(h5File)
        driftSeriesSets = seriesSet.split(isInDriftState)

        ####
            
        for seriesSet in driftSeriesSets:
            analyzer.vertical_acceleration = seriesSet.accelerationVertical
            swh = analyzer.getSignificantWaveHeight()
            print(f'SWH = {swh}')
