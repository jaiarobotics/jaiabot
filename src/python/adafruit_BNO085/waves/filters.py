from math import *
from copy import *
from pyjaia.series import Series


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


def cos2Filter(minFreq: float, minWindow: float, maxFreq: float, maxWindow: float):
    min0 = minFreq - minWindow / 2
    min1 = minFreq + minWindow / 2

    max0 = maxFreq - maxWindow / 2
    max1 = maxFreq + maxWindow / 2

    kMin = pi / minWindow
    kMax = pi / maxWindow

    def filterFunc(freq: float):
        if freq <= min0 or freq >= max1:
            return 0
        if freq >= min1 and freq <= max0:
            return 1
        
        if freq > min0 and freq < min1:
            c = (cos((min1 - freq) * kMin) + 1) / 2
            return c * c
        
        if freq > max0 and freq < max1:
            c = (cos((freq - max0) * kMax) + 1) / 2
            return c * c

    return filterFunc
