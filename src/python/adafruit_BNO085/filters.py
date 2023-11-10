from math import *
from copy import *
from series import Series


def brickWallFilter(minFreq: float, maxFreq: float):
    def filterFunc(freq: float):
        if freq > minFreq and freq < maxFreq:
            return 1.0
        else:
            return 0.0
        
    return filterFunc


def gaussianFilter(minFreq: float, maxFreq: float, k: float):
    def filterFunc(freq: float):
        if freq < minFreq:
            return exp(-k * (freq - minFreq)**2)
        if freq < maxFreq:
            return 1.0
        else:
            return exp(-k * (freq - maxFreq)**2)
        
    return filterFunc


def cos2Filter(minFreq: float, maxFreq: float, window: float):
    min0 = minFreq - window / 2
    min1 = minFreq + window / 2

    max0 = maxFreq - window / 2
    max1 = maxFreq + window / 2

    k = pi / window

    def filterFunc(freq: float):
        if freq <= min0 or freq >= max1:
            return 0
        if freq >= min1 and freq <= max0:
            return 1
        
        if freq > min0 and freq < min1:
            c = (cos((min1 - freq) * k) + 1) / 2
            return c * c
        
        if freq > max0 and freq < max1:
            c = (cos((freq - max0) * k) + 1) / 2
            return c * c

    return filterFunc


def filterAcc(series: Series):
    newSeries = deepcopy(series)
    newSeries.name = f'Filtered {series.name}'
    newSeries.y_values = list(newSeries.y_values) # In case it's a tuple
    Y = newSeries.y_values
    t = newSeries.utime

    ERR = 0.2
    ERR_LINEAR_EXTRAPOLATION = 0.64

    for i in range(2, len(Y) - 2 - 1):
        y = Y[i]

        average_y = (Y[i-1] + Y[i+1]) / 2
        if abs(y - average_y) < ERR:
            continue

        y_linear_extrapolation = Y[i-1] + (t[i] - t[i-1]) * (Y[i-1] - Y[i-2]) / (t[i-1] - t[i-2])

        if abs(y - y_linear_extrapolation) < ERR_LINEAR_EXTRAPOLATION:
            continue

        y_corrections = [-1.28, +1.28]

        for y_correction in y_corrections:
            y_corrected = y + y_correction

            if abs(y_corrected - average_y) < ERR:
                Y[i] = y_corrected
                break

            if abs(y_corrected - Y[i-1]) < ERR and abs(y_corrected - (Y[i+1] + y_correction)) < ERR:
                Y[i] = y_corrected
                break
        
    return newSeries
    
