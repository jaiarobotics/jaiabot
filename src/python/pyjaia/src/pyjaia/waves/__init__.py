from .series_set import *
from .drift import *
from .processing import *


def doAnalysis(verticalAcceleration: Series, sampleFreq: float):
    drift = Drift()
    drift.rawVerticalAcceleration = verticalAcceleration.makeUniform(sampleFreq)
    drift.filteredVerticalAcceleration = filterAcceleration(drift.rawVerticalAcceleration, sampleFreq)
    drift.elevation = calculateElevationSeries(drift.rawVerticalAcceleration, sampleFreq)
    drift.waveHeights = calculateSortedWaveHeights(drift.elevation)
    drift.significantWaveHeight = significantWaveHeight(drift.waveHeights)
    
    return drift
