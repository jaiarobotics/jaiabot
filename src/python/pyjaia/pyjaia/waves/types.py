from dataclasses import dataclass
from typing import *
from pyjaia.series import Series


@dataclass
class Wave:
    height: float
    period: float


@dataclass
class Drift:
    rawVerticalAcceleration: Series
    verticalAcceleration: Series
    powerDensitySpectrum: List[float]
    elevation: Series
    gpsAltitude: Series

    waves: List[Wave]
    significantWaveHeight: float
    maxWaveHeight: float
    peakWavePeriod: float

    def __init__(self):
        self.rawVerticalAcceleration = None
        self.verticalAcceleration = None

        self.gpsAltitude = None
        self.gpsFilteredAltitude = None

        self.powerDensitySpectrum = None
        self.elevation = Series('Elevation')
        self.waves = None
        self.significantWaveHeight = 0.0
        self.maxWaveHeight = None
        self.peakWavePeriod = 0.0


@dataclass
class WindowConfig:
    type: str
    duration: float = None

    @staticmethod
    def fromDict(input: Dict):
        return WindowConfig(**input)


@dataclass
class BandPassFilterConfig:
    type: str
    minZeroPeriod: float
    minPeriod: float
    maxPeriod: float
    maxZeroPeriod: float


    @staticmethod
    def fromDict(input: Dict):
        return BandPassFilterConfig(**input)


@dataclass
class AnalysisConfig:
    type: str
    segmentLength: int = None

    @staticmethod
    def fromDict(input: Dict):
        return AnalysisConfig(**input)


@dataclass
class DriftAnalysisConfig:
    glitchy: bool = False
    sampleFreq: float = 4.0

    source: str = None
    """Data source: "gps" or "imu" """
    window: WindowConfig = None
    bandPassFilter: BandPassFilterConfig = None
    analysis: AnalysisConfig = None

    @staticmethod
    def fromDict(input: Dict):
        config = DriftAnalysisConfig(**input)
        config.window = WindowConfig.fromDict(config.window)
        config.bandPassFilter = BandPassFilterConfig.fromDict(config.bandPassFilter)
        config.analysis = AnalysisConfig.fromDict(config.analysis)
        return config


    @staticmethod
    def load(configFilename: str):
        import json

        if not configFilename.endswith('.json'):
            configFilename += '.json'

        configDict = json.load(open(configFilename))
        return DriftAnalysisConfig.fromDict(configDict)


    @staticmethod
    def default():
        return DriftAnalysisConfig.fromDict({
            "glitchy": False,
            "sampleFreq": 4,
            "source": "gps",
            "window": {
                "type": "tukey",
                "duration": 10
            },
            "bandPassFilter": {
                "type": "cos^2",
                "minZeroPeriod": 0.75,
                "minPeriod": 1.0,
                "maxPeriod": 15.0,
                "maxZeroPeriod": 20.0
            },
            "analysis": {
                "type": "welch",
                "segmentLength": 640
            }
        })

