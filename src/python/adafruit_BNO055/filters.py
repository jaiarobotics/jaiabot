from math import *


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
