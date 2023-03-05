from dataclasses import dataclass
from math import *
from typing import *
from scipy.fft import dct
import numpy


@dataclass
class Component:
    frequency: float
    amplitude: float


def primary_harmonic(series):
    max_component = Component(0, 0)
    for i, val in enumerate(series):
        # Throw away the constant term
        if i == 0:
            continue

        val = abs(val)

        if 2 * val > max_component.amplitude:
            max_component.amplitude = 2 * val
            max_component.frequency = i / 2

    return max_component


class WaveAnalyzer:
    '''This class ingests a series of accelerations, and returns a numerically-integrated wave height'''

    accelerations: List[float] = []
    max_points = 100
    dt: float


    def __init__(self, max_points: int, dt: float) -> None:
        self.max_points = max_points
        self.dt = dt


    def addAcceleration(self, acceleration: float):
        self.accelerations.append(acceleration)
        if len(self.accelerations) > self.max_points:
            self.accelerations.pop(0)


    def wave(self) -> Component:
        discrete_cosine_transform = dct(self.accelerations, norm='forward')
        primary = primary_harmonic(discrete_cosine_transform)

        window_timespan = self.dt * len(self.accelerations)
        primary.frequency = primary.frequency / window_timespan # Convert to Hz, instead of per DCT window

        # Height amplitude from acceleration component, (integrate acceleration twice)
        primary.amplitude /= (2 * pi * primary.frequency) ** 2

        return primary


if __name__ == '__main__':

    x = numpy.array([3 * cos(2 * pi * i / 10) ** 1.5 for i in range(0, 50)])

    wave_analyzer = WaveAnalyzer(100, 0.1)

    wave_analyzer.accelerations = list(x)
    print(wave_analyzer.wave())
