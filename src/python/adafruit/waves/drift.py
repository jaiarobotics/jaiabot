from pyjaia.series import *
from typing import *
from dataclasses import *


@dataclass
class Drift:
    rawVerticalAcceleration: Series
    filteredVerticalAcceleration: Series
    elevation: Series

    waveHeights: List[float]
    significantWaveHeight: float

    def __init__(self):
        self.rawVerticalAcceleration = Series('Raw Vertical Acceleration')
        self.filteredVerticalAcceleration = Series('Filtered Vertical Acceleration')
        self.elevation = Series('Elevation')
        self.waveHeights = []
        self.significantWaveHeight = 0.0
