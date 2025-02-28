from typing import *
import numpy
from math import *
from pyjaia.series import Series
from .processing import *
from .series_set import *
from .types import *
from .window import *
import statistics

def heightFromAcceleration(acceleration: List[float], sampleFrequency: float):
    N = len(acceleration)
    if N < 2:
        return numpy.array([])

    A = numpy.fft.fft(acceleration)
    X = [0.0] * N

    for i in range(1, N // 2 + 1):
        f = i * sampleFrequency / N
        X[i] = A[i] / (4 * pi**2 * f**2)
        X[N - i] = A[N - i] / (4 * pi**2 * f**2)

    return numpy.real(numpy.fft.ifft(X))


def accelerationToElevation(acceleration: Series, sampleFrequency: float):
    # acceleration = deMean(acceleration)

    elevation = Series('Elevation (m)')
    elevation.utime = deepcopy(acceleration.utime)
    elevation.y_values = heightFromAcceleration(acceleration.y_values, sampleFrequency)
    return elevation


def significantWaveHeight(powerSpectrum: List[float], sampleFrequency: float):
    if len(powerSpectrum) < 1:
        return None

    df = sampleFrequency / 2 / len(powerSpectrum)
    meanZetaSquared = 0.0 # Mean height
    for i in range(1, len(powerSpectrum)):
        meanZetaSquared += powerSpectrum[i] * df
    return 4 * meanZetaSquared**0.5


def significantWaveHeightFromElevation(elevation: List[float]):
    meanZetaSquared = statistics.mean([height**2 for height in elevation])
    return 4 * meanZetaSquared**0.5


def maximumWaveHeightFromElevation(elevations: List[float]):
    trough = 0.0
    crest = 0.0
    maxWaveHeight = 0.0
    lastElevation = 0.0

    for elevation in elevations:
        if elevation < 0.0:
            if lastElevation >= 0.0:
                # Completed a wave
                waveHeight = crest - trough
                maxWaveHeight = max(maxWaveHeight, waveHeight)
            trough = min(trough, elevation)

        if elevation > 0.0:
            crest = max(crest, elevation)

    return maxWaveHeight


def peakWavePeriod(powerSpectrum: List[float], sampleFrequency: float):
    N = len(powerSpectrum)
    if N < 2:
        return None

    maxPowerDensity = 0.0
    maxIndex = 0

    for index, powerDensity in enumerate(powerSpectrum):
        if powerDensity > maxPowerDensity:
            maxPowerDensity = powerDensity
            maxIndex = index

    maxFrequency = maxIndex * sampleFrequency / 2 / N

    if maxFrequency == 0.0:
        return 0.0

    return 1.0 / maxFrequency


def powerSpectrumFFT(acceleration: List[float], sampleFrequency: float):
    N = len(acceleration)
    if N < 2:
        return numpy.array([])

    A = numpy.fft.fft(acceleration)
    S: List[float] = [0.0] * (N // 2 + 1) # Power density spectrum

    for i in range(1, N // 2 + 1):
        f = i * sampleFrequency / N
        amplitude = numpy.absolute(A[i] / (4 * pi**2 * f**2))
        S[i] = amplitude**2 / (N // 2 * sampleFrequency)

    return S


def powerSpectrumPeriodogram(elevation: List[float], config: DriftAnalysisConfig):
    if len(elevation) < 2:
        return numpy.array([])
    
    from scipy.signal import periodogram
    frequencies, power_spectrum = periodogram(elevation, fs=config.sampleFreq)
    return power_spectrum


def powerSpectrumWelch(elevation: List[float], config: DriftAnalysisConfig):
    N = len(elevation)
    if N < 2:
        return numpy.array([])
    
    from scipy.signal import welch

    frequencies, power_spectrum = welch(
        elevation,  # Input signal
        fs=config.sampleFreq,    # Sampling frequency (Hz)
        nperseg=min(config.analysis.segmentLength, N), # Length of each segment
        scaling='density'        # Power spectral density scaling
    )

    # Re-normalize from the windowing function
    ms = getMeanSquareOfWindow(config.window, len(elevation) / config.sampleFreq, config.sampleFreq)

    return [ x / ms for x in power_spectrum ]


def powerSpectrumBurg(elevation: List[float], config: DriftAnalysisConfig):
    if len(elevation) < 2:
        return numpy.array([])
    
    from spectrum import pburg
    
    ar_psd = pburg(elevation, order=10)
    return ar_psd().psd


def doDriftAnalysis(seriesSet: SeriesSet, config: DriftAnalysisConfig):
    drift = Drift()
    drift.rawSeriesSet = deepcopy(seriesSet)

    trimStartMicros = 10e6
    trimEndMicros = 5e6

    # Get the elevation series using the source specified
    if config.source == 'gps':
        drift.gpsAltitude = seriesSet.altitude

        drift.elevation = trimSeries(drift.gpsAltitude, trimStartMicros, trimEndMicros).deduplicate().resample(config.sampleFreq)
    elif config.source == 'imu':
        drift.verticalAcceleration = trimSeries(drift.rawSeriesSet.accelerationVertical, trimStartMicros, trimEndMicros).resample(config.sampleFreq)
        drift.elevation = accelerationToElevation(drift.verticalAcceleration, config.sampleFreq)
    else:
        print(f'Unknown source type: {config.source=}')
        exit(1)

    # Apply window and band pass filter
    drift.elevation.name = 'Elevation (m)'
    drift.elevation = filterFrequencies(drift.elevation, config.sampleFreq, config.bandPassFilter)
    drift.elevation = applyWindow(drift.elevation, config.window)
    drift.maxWaveHeight = maximumWaveHeightFromElevation(drift.elevation.y_values)

    # Do analysis using the elevation series
    if config.analysis.type == 'counting':
        drift = doWaveCounting(drift, config)
    elif config.analysis.type == 'fft':
        drift = doFFT(drift, config)
    elif config.analysis.type == 'welch':
        drift = doWelch(drift, config)
    elif config.analysis.type == 'periodogram':
        drift = doPeriodogram(drift, config)
    else:
        print(f'Unknown analysis type: {config.analysis.type}')
        exit(1)

    return drift


def doDriftAnalysisFromFile(h5File: h5py.File, timeRange: List[int], config: DriftAnalysisConfig):
    seriesSet = SeriesSet.loadFromH5File(h5File)
    driftSeriesSet = seriesSet.slice(TimeRange(start=timeRange[0], end=timeRange[1]))

    return doDriftAnalysis(driftSeriesSet.accelerationVertical, config)


def doWaveCounting(drift: Drift, config: DriftAnalysisConfig):
    drift.waves = getSortedWaves(drift.elevation)
    drift.significantWaveHeight = significantWaveHeightFromWaveList(drift.waves)
    
    peakWave = max(drift.waves, key=lambda wave: wave.height)
    drift.maxWaveHeight = peakWave.height
    drift.peakWavePeriod = peakWave.period
    
    return drift


def doFFT(drift: Drift, config: DriftAnalysisConfig):
    drift.powerDensitySpectrum = powerSpectrumFFT(drift.verticalAcceleration.y_values, config.sampleFreq)
    drift.significantWaveHeight = significantWaveHeight(drift.powerDensitySpectrum, config.sampleFreq)
    drift.peakWavePeriod = peakWavePeriod(drift.powerDensitySpectrum, config.sampleFreq)
    
    return drift


def doWelch(drift: Drift, config: DriftAnalysisConfig):
    drift.powerDensitySpectrum = powerSpectrumWelch(drift.elevation.y_values, config)
    drift.significantWaveHeight = significantWaveHeight(drift.powerDensitySpectrum, config.sampleFreq)
    drift.peakWavePeriod = peakWavePeriod(drift.powerDensitySpectrum, config.sampleFreq)
    
    return drift


def doPeriodogram(drift: Drift, config: DriftAnalysisConfig):
    drift.powerDensitySpectrum = powerSpectrumPeriodogram(drift.elevation.y_values, config)
    drift.significantWaveHeight = significantWaveHeight(drift.powerDensitySpectrum, config.sampleFreq)
    drift.peakWavePeriod = peakWavePeriod(drift.powerDensitySpectrum, config.sampleFreq)
    
    return drift


def getPowerDensitySpectrumFrequencies(N: int, sampleFrequency: float):
    return [i * sampleFrequency / 2 / N for i in range(N)]
