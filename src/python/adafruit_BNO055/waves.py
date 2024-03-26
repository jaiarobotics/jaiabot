from math import *
from typing import *
from imu import *
from threading import Thread, Lock
from time import sleep

from series import *
from processing import *
from filters import *

import json
import logging
import plotly.express as px

log = logging.getLogger('jaiabot_imu')

DEBUG_PATH = '/var/log/jaiabot/bot/'


def isValidReading(reading: IMUReading):
    '''Returns True if this reading doesn't contain an obvious glitch in gravity or linear_acceleration'''

    g_mag = reading.gravity.magnitude()
    a_mag = reading.linear_acceleration.magnitude()
    if g_mag < 8 or g_mag > 50:
        return False
    
    if abs(reading.gravity.x) < 0.02 or abs(reading.gravity.y) < 0.02 or abs(reading.gravity.z) < 0.02: # Sometimes the gravity components glitch out to 0.01 for no reason
        return False
    
    if a_mag == 0 or a_mag > 50:
        return False

    return True


class Analyzer:
    debug_mode = False

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
                            if isValidReading(reading):
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


    def dump_debug(self):
        '''Dump some debug data to a log file'''

        # Dump debug data
        swh = calculateSignificantWaveHeight(self.linear_acceleration_x, self.linear_acceleration_y, self.linear_acceleration_z, self.gravity_x, self.gravity_y, self.gravity_z, debug_mode=True)


    def startSamplingForWaveHeight(self):
        with self._lock:
            self.clearAccelerationSeries()
            self._sampling_for_wave_height = True

    def stopSamplingForWaveHeight(self):
        with self._lock:
            if self.debug_mode:
                self.dump_debug()

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


def calculateSignificantWaveHeight(acc_x: Series, acc_y: Series, acc_z: Series, g_x: Series, g_y: Series, g_z: Series, debug_mode=False):
    # Filter out glitches from the IMU
    acc_x = filterAcc(acc_x)
    acc_y = filterAcc(acc_y)
    acc_z = filterAcc(acc_z)

    g_x = filterAcc(g_x)
    g_y = filterAcc(g_y)
    g_z = filterAcc(g_z)

    # Get the vertical acceleration series
    acc_vertical = Series()
    acc_vertical.name = 'acc_vertical'
    acc_vertical.utime = acc_x.utime
    for i in range(len(acc_x.utime)):
        acc_vertical.y_values.append((acc_x.y_values[i] * g_x.y_values[i] + 
                                      acc_y.y_values[i] * g_y.y_values[i] + 
                                      acc_z.y_values[i] * g_z.y_values[i]) / 9.8)
        
    # Get a uniformly-sampled series (for our FFT)
    sampleFreq = 4
    acc_vertical = getUniformSeries(freq=sampleFreq)(acc_vertical)

    # Define bandpass filter
    bandPassFilter = cos2Filter(1/15, 2.0, 0.01)

    # De-mean the series
    acc_vertical = deMean(acc_vertical)

    # Fade the acceleration in and out from 10 seconds in, to 5 seconds before the end (to avoid noise from the motor)
    acc_vertical = fadeSeries(acc_vertical, 10e6, 5e6, 5e6)

    # Calculate an elevation series from the acceleration series
    elev_vertical = accelerationToElevation(acc_vertical, sampleFreq=sampleFreq, filterFunc=bandPassFilter)

    # Calculate a list of sorted wave heights
    sorted_wave_heights = calculateSortedWaveHeights(elev_vertical)

    swh = calculateSignificantWaveHeightFromSortedWaveHeights(sorted_wave_heights)

    if debug_mode:
        html_path = f'{DEBUG_PATH}/swh_debug_{datetime.now().strftime("%Y-%m-%dT%H%M%S")}.html'
        fig = Series.createPlotlyFigure([
            acc_x, acc_y, acc_z,
            g_x, g_y, g_z,
            acc_vertical,
            elev_vertical,
        ])
        fig.write_html(html_path)
        logging.warning(f'Wrote html to {html_path}')

        json_path = f'{DEBUG_PATH}/swh_debug_{datetime.now().strftime("%Y-%m-%dT%H%M%S")}.json'
        with open(json_path, 'w') as file:
            json.dump({
                'sortedWaveHeights': sorted_wave_heights,
                'significant_wave_height': swh,
            }, file)
 
    return swh


if __name__ == '__main__':
    imu = Simulator(wave_frequency=0.33, wave_height=0.35)
    analyzer = Analyzer(imu=imu, sample_frequency=4)

    analyzer.startSamplingForWaveHeight()

    while True:
        print(analyzer.getSignificantWaveHeight())
        sleep(1)
