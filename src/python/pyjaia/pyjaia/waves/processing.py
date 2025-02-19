from copy import deepcopy
from pyjaia.series import Series
from typing import *
import numpy
import statistics
from math import *
from .filters import cos2Filter
from .types import *
import pyjaia.waves.filters as filters
from .window import applyTukeyWindow


def trimSeries(series: Series, startGap: float, endGap: float=None):
    """Trim from the beginning and end of a series.

    Args:
        series (Series): Input series.
        startGap (float): Time interval (in microseconds) to trim from start.
        endGap (float, optional): Time interval (in microseconds) to trim from end. Defaults to None, which means same as startGap.

    Returns:
        Series: The trimmed series.
    """

    endGap = endGap or 0

    newSeries = deepcopy(series)
    newSeries.clear()

    # Guard against empty series
    if len(series.utime) < 1:
        return newSeries

    startTimeAbsolute = series.utime[0] + startGap
    endTimeAbsolute = series.utime[-1] - endGap

    for index in range(len(series.utime)):
        t = series.utime[index]

        # Outside slice range
        if t < startTimeAbsolute or t > endTimeAbsolute:
            continue

        newSeries.utime.append(t)
        newSeries.y_values.append(series.y_values[index])

    return newSeries


def getBandPassFilterFunc(bandPassFilterConfig: BandPassFilterConfig):
    if bandPassFilterConfig.type == 'cos^2':
        maxFreq = 1.0 / bandPassFilterConfig.minPeriod
        minFreq = 1.0 / bandPassFilterConfig.maxPeriod
        maxWindow = 1.0 / bandPassFilterConfig.minZeroPeriod - maxFreq
        minWindow = minFreq - 1.0 / bandPassFilterConfig.maxZeroPeriod
        return cos2Filter(minFreq, minWindow, maxFreq, maxWindow)
    elif bandPassFilterConfig.type == 'none':
        return filters.noFilter
    else:
        print(f'Unknown band pass filter type: {bandPassFilterConfig.type}')
        exit(1)


def filterFrequencies(inputSeries: Series, sampleFreq: float, bandPassFilterConfig: BandPassFilterConfig):
    """Applies a frequency filter to a series.

    Args:
        inputSeries (Series): Input series.
        sampleFreq (float): Sampling frequency (Hz).
        filterFunc (Callable[[float], float]): A function that takes a frequency, and returns a gain coefficient to apply to that frequency.

    Returns:
        Series: The resulting filtered frequency.
    """
    if len(inputSeries.utime) < 2:
        return Series()

    bandPassFilterFunc = getBandPassFilterFunc(bandPassFilterConfig)

    A = numpy.fft.fft(inputSeries.y_values)
    N = len(inputSeries.y_values)

    for i in range(1, N // 2 + 1):
        f = i * sampleFreq / N
        A[i] *= bandPassFilterFunc(f)
        A[N - i] *= bandPassFilterFunc(f)

    a = numpy.real(numpy.fft.ifft(A))
    series = Series()
    series.utime = inputSeries.utime[:len(a)]
    series.y_values = list(a)

    if (len(series.utime) != len(series.y_values)):
        print(len(series.utime), len(series.y_values))
        exit(1)

    return series


def deMean(series: Series):
    """De-means a series.

    Args:
        series (Series): The input series.

    Returns:
        Series: The de-meaned series (subtract the mean value from every point in the series).
    """
    newSeries = Series()

    if len(series.utime) == 0:
        return newSeries

    y_mean = statistics.mean(series.y_values)
    newSeries.utime = series.utime
    newSeries.y_values = [y - y_mean for y in series.y_values]

    return newSeries


def getSortedWaves(elevationSeries: Series) -> List[Wave]:
    """Gets a sorted list of Wave objects from an input elevation series.

    Args:
        elevationSeries (Series): Input elevation series.

    Returns:
        list[Wave]: A sorted list of wave heights.
    """
    waves: List[Wave] = []
    ys = elevationSeries.y_values

    trough = None
    peak = None
    trough_t = None
    peak_t = None

    oldDy = 0

    # Find waves
    for index, y in enumerate(ys):
        if index > 0:
            previous_y = ys[index - 1]
            dy = y - previous_y

            if dy > 0 and oldDy <=0:
                trough = previous_y
                trough_t = elevationSeries.utime[index] / 1e6
            elif dy < 0 and oldDy >= 0:
                peak = previous_y
                peak_t = elevationSeries.utime[index] / 1e6

                if trough is not None:
                    wave = Wave(height=peak - trough, period=(peak_t - trough_t) * 2)
                    waves.append(wave)

            oldDy = dy

    sortedWaves = sorted(waves, key=lambda w: w.height)

    return sortedWaves


def significantWaveHeightFromWaveList(waves: List[Wave]):
    """Returns the significant wave height from an unsorted list of wave heights.

    Args:
        waveHeights (List[float]): Unsorted list of wave heights.

    Returns:
        float: The significant wave height (mean of the tallest 2/3 of the waves).
    """
    if len(waves) == 0:
        return 0.0

    sortedWaveHeights = sorted([wave.height for wave in waves])
    N = floor(len(sortedWaveHeights) * 2 / 3)
    significantWaveHeights = sortedWaveHeights[N:]

    return statistics.mean(significantWaveHeights)


def filterAcceleration(accelerationSeries: Series, sampleFreq: float, bandPassFilterConfig: BandPassFilterConfig):
    """Process and filter an input acceleration series.

    Args:
        accelerationSeries (Series): The input acceleration series.

    Returns:
        Series: The processed and filtered acceleration series.
    """

    series = filterFrequencies(accelerationSeries, sampleFreq, bandPassFilterConfig)
    series.name = 'Filtered acceleration (m/s^2)'

    return series
