from datetime import timedelta
from math import *
import statistics

from .drift import Drift
import spectrogram


def formatTimeDelta(td: timedelta):
    components = []
    seconds = td.seconds
    if seconds >= 60:
        minutes = math.floor(seconds / 60)
        components.append(f'{minutes}m')
        seconds -= (minutes * 60)
    if seconds > 0:
        components.append(f'{seconds}s')

    return ' '.join(components)


def htmlForDrift(drift: Drift):
    # Header
    htmlString = ''

    htmlString += f'<h1>Drift Analysis</h1>'
    durationString = formatTimeDelta(drift.elevation.duration())
    htmlString += f'<h3>Drift duration: {durationString}<h3>'

    if len(drift.waveHeights) > 0:
        swh = statistics.mean(drift.waveHeights[floor(len(drift.waveHeights)*2/3):])
        htmlString += f'<h3>Significant Wave Height: {swh:0.2f}<h3>'

    # The wave heights
    htmlString += htmlForWaves(waveHeights)

    htmlString += htmlForChart([uniformAcceleration, filteredAccelerationSeries, elevationSeries])
    htmlString += htmlForChart([drift.grav_x])
    grav_x_uniform = drift.grav_x.makeUniform(sampleFreq)
    htmlString += spectrogram.htmlForSpectrogram(grav_x_uniform, fftWindowSeconds=80)
    htmlString += spectrogram.htmlForSpectrogram(uniformAcceleration, fftWindowSeconds=80)
    htmlString += spectrogram.htmlForSpectrogram(filteredAccelerationSeries, fftWindowSeconds=80)

    return htmlString
    