from copy import deepcopy
from series import Series
from typing import *
import numpy
import statistics
from math import *

def floatRange(start: float, end: float, delta: float):
    x = start

    while x < end:
        yield x
        x += delta


def getMovingAverages(values: List[float], window: int):
    output = []

    for i, value in enumerate(values):
        start = max(0, i - window)
        end = min(len(values), i + window + 1)
        mean = statistics.mean(values[start:end])
        output.append(mean)

    return output


ProcessingStep = Callable[[Series], Series]


def addSeries(otherSeries: Series):
    def f(series: Series):
        newSeries = deepcopy(series)
        newSeries.y_values = [series.y_values[index] + otherSeries.getValueAtTime(series.utime[index]) for index in range(len(series.utime))]
        return newSeries
    
    return f


def removeStairSteps(stepSize: float):
    def f(series: Series):
        series = deepcopy(series)
        # Remove stairstepping that exceeds the threshold
        y_values = [series.y_values[0]]
        for index in range(1, len(series.y_values)):
            y1 = series.y_values[index - 1]
            y2 = series.y_values[index]
            delta = y2 - y1
            if abs(delta) >= stepSize:
                delta = 0
            y_values.append(y_values[-1] + delta)

        series.y_values = y_values

        return series
    
    return f


def subtractLinearTerm(series: Series):
    series = deepcopy(series)
    y_values = series.y_values

    # Subtract out a linear term
    k = (y_values[-1] - y_values[0]) / len(y_values)

    for i in range(len(y_values)):
        y_values[i] -= (i * k)
    
    series.y_values = y_values

    return series


def getUniformSeries(freq: float):
    def f(series: Series):
        '''Returns a new Series object using this Series\' data, sampled at a constant frequency and suitable for an Fourier-type transform'''
        newSeries = Series()
        if len(series.utime) == 0:
            return newSeries
        
        for utime in floatRange(series.utime[0] + 1, series.utime[-1], 1e6 / freq):
            newSeries.utime.append(utime)
            newSeries.y_values.append(series.getValueAtTime(utime))
        return newSeries
    
    return f


def sliceSeries(startTime: float):
    '''Slice start of series.  startTime is in microseconds.'''
    def f(series: Series):
        '''Returns a new Series object with the first startTime chopped off.'''
        newSeries = Series()

        if len(series.utime) == 0:
            return newSeries

        startTimeAbsolute = series.utime[0] + startTime
        for index in range(len(series.utime)):
            if series.utime[index] > startTimeAbsolute:
                newSeries.utime.append(series.utime[index])
                newSeries.y_values.append(series.y_values[index])

        return newSeries
    
    return f


def subtractMovingAverage(window: int):
    def f(series: Series):
        movingAverages = getMovingAverages(series.y_values, window)

        newSeries = Series()
        newSeries.utime = deepcopy(series.utime)

        for i, movingAverage in enumerate(movingAverages):
            newSeries.y_values.append(series.y_values[i] - movingAverage)

        return newSeries

    return f


def filterFrequencies(sampleFreq: float, filterFunc: Callable[[float], float]):
    def f(inputSeries: Series):
        '''Uses a real FFT to filter out frequencies between minFreq and maxFreq, and returns the filtered Series'''
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

    return f


def accelerationToElevation(sampleFreq: float, filterFunc: Callable[[float], float]):
    def f(inputSeries: Series):
        '''Uses a real FFT to filter out frequencies between minFreq and maxFreq, and returns the filtered Series'''
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
            print(len(series.utime), len(series.y_values))
            exit(1)

        return series

    return f


def processSeries(series: Series, steps: List[ProcessingStep]):
    for step in steps:
        series = step(series)
    return series
