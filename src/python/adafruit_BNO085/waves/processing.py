from copy import deepcopy
from pyjaia.series import Series
from typing import *
import numpy
import statistics
from math import *
from .filters import cos2Filter


def applyHannWindow(series: Series, fadePeriod: float=2e6):
    """Apply a Hann window to the start and end of the series.

    Args:
        series (Series): Input series.
        fadePeriod (float, optional): Time period (in microseconds), for the Hann window to move from 0 to 1. Defaults to 2e6.

    Returns:
        Series: The resulting Hann-windowed series.
    """

    newSeries = deepcopy(series)

    if len(series.utime) == 0:
        return newSeries

    startFadeEndTime = series.utime[0] + fadePeriod
    endFadeStartTime = series.utime[-1] - fadePeriod

    for index in range(len(series.utime)):
        t = series.utime[index]
        # Fade range
        k = 1

        if t < startFadeEndTime:
            k *= ((cos((startFadeEndTime - t) * (pi) / (fadePeriod)) + 1) / 2)
        elif t > endFadeStartTime:
            k *= ((cos((t - endFadeStartTime) * (pi) / (fadePeriod)) + 1) / 2)

        newSeries.y_values[index] *= k

    return newSeries


def trimSeries(series: Series, startGap: float, endGap: float=None):
    """Trim from the beginning and end of a series.

    Args:
        series (Series): Input series.
        startGap (float): Time interval to trim from start.
        endGap (float, optional): Time interval to trim from end. Defaults to None, which means same as startGap.

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


def filterFrequencies(inputSeries: Series, sampleFreq: float, filterFunc: Callable[[float], float]):
    """Applies a frequency filter to a series.

    Args:
        inputSeries (Series): Input series.
        sampleFreq (float): Sampling frequency (Hz).
        filterFunc (Callable[[float], float]): A function that takes a frequency, and returns a gain coefficient to apply to that frequency.

    Returns:
        Series: The resulting filtered frequency.
    """
    if len(inputSeries.utime) == 0:
        return Series()

    A = numpy.fft.rfft(inputSeries.y_values)
    n = len(A)
    nyquist = sampleFreq / 2

    if n % 2 == 0:
        freqCoefficient = nyquist / n
    else:
        freqCoefficient = nyquist * (n - 1) / n / n

    for index in range(len(A)):
        freq = freqCoefficient * index
        A[index] *= filterFunc(freq)

    a = numpy.fft.irfft(A)
    series = Series()
    series.utime = inputSeries.utime[:len(a)]
    series.y_values = list(a)

    if (len(series.utime) != len(series.y_values)):
        print(len(series.utime), len(series.y_values))
        exit(1)

    return series


def accelerationToElevation(inputSeries: Series, sampleFreq: float, filterFunc: Callable[[float], float]):
    """Converts a uniform acceleration series to a uniform elevation series, by applying a frequency filter and double-integrating.

    Args:
        inputSeries (Series): Uniform series of acceleration values (m/s^2).
        sampleFreq (float): Sampling frequency (Hz).
        filterFunc (Callable[[float], float]): A function that takes a frequency, and returns a gain coefficient to apply to that frequency.

    Returns:
        Series: The resulting elevation series.
    """

    if len(inputSeries.utime) < 2:
        # If there are 0 or 1 data points, we're not going to be able to do the irfft
        return Series()

    A = numpy.fft.rfft(inputSeries.y_values)
    n = len(A)
    nyquist = sampleFreq / 2

    if n % 2 == 0:
        freqCoefficient = nyquist / n
    else:
        freqCoefficient = nyquist * (n - 1) / n / n

    for index in range(len(A)):
        if index == 0: # Get rid of constant acceleration term
            A[index] = 0
            continue

        freq = freqCoefficient * index

        A[index] *= filterFunc(freq)

        A[index] /= (-(2 * pi * freq) ** 2) # Integrate acceleration to elevation series (integrate a sin curve twice)

    a = numpy.fft.irfft(A)
    series = Series()
    series.utime = inputSeries.utime[:len(a)]
    series.y_values = list(a)

    if (len(series.utime) != len(series.y_values)):
        print(f'ERROR: utime and y_values not of same length!')
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


def calculateSortedWaveHeights(elevationSeries: Series):
    """Gets a sorted list of wave heights from an input elevation series.

    Args:
        elevationSeries (Series): Input elevation series.

    Returns:
        list[float]: A sorted list of wave heights.
    """
    waveHeights: List[float] = []
    ys = elevationSeries.y_values

    trough = None
    peak = None

    oldDy = 0

    # Find waves
    for index, y in enumerate(ys):
        if index > 0:
            dy = y - ys[index - 1]

            if dy > 0 and oldDy <=0:
                trough = y
            elif dy < 0 and oldDy >= 0:
                peak = y

                if trough is not None:
                    waveHeights.append(peak - trough)

            oldDy = dy

    sortedWaveHeights = sorted(waveHeights)

    return sortedWaveHeights


def significantWaveHeight(waveHeights: List[float]):
    """Returns the significant wave height from an unsorted list of wave heights.

    Args:
        waveHeights (List[float]): Unsorted list of wave heights.

    Returns:
        float: The significant wave height (mean of the tallest 2/3 of the waves).
    """
    if len(waveHeights) == 0:
        return 0.0

    sortedWaveHeights = sorted(waveHeights)
    N = floor(len(sortedWaveHeights) * 2 / 3)
    significantWaveHeights = sortedWaveHeights[N:]

    return statistics.mean(significantWaveHeights)


BandPassFilterFunc = Callable[[float], float]
bandPassFilter = cos2Filter(1/15, 1/120, 2, 2)


def calculateElevationSeries(accelerationSeries: Series, sampleFreq: float):
    """Calculates the elevation series from an input acceleration series.

    Args:
        accelerationSeries (Series): The acceleration series.

    Returns:
        Series: The elevation series, calculated by de-meaning, trimming, windowing, FFT, and double integration.
    """

    series = accelerationSeries
    series = trimSeries(series, 10e6, 5e6)
    series = applyHannWindow(series, fadePeriod=2e6)
    series = deMean(series)
    series = accelerationToElevation(series, sampleFreq=sampleFreq, filterFunc=bandPassFilter)

    return series


def filterAcceleration(accelerationSeries: Series, sampleFreq: float):
    """Process and filter an input acceleration series.

    Args:
        accelerationSeries (Series): The input acceleration series.

    Returns:
        Series: The processed and filtered acceleration series.
    """

    series = accelerationSeries
    series = trimSeries(series, 10e6, 5e6)
    series = applyHannWindow(series, fadePeriod=2e6)
    series = deMean(series)
    series = filterFrequencies(series, sampleFreq=sampleFreq, filterFunc=bandPassFilter)

    return series

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

