from dataclasses import dataclass
from math import *
from typing import *
from scipy.fft import dct, fft
import numpy


@dataclass
class Component:
    frequency: float
    amplitude: float


def get_components(input_dct: List[float], window_time_length: float):
    return [
        Component(i / 2 / window_time_length, amplitude=2 * x)
        for i, x in enumerate(input_dct)
    ]


def sort_by_amplitude(spectrum: List[Component]) -> List[Component]:
    return list(sorted(spectrum, key=lambda component: abs(component.amplitude), reverse=True))


def acceleration_to_height(acceleration_spectrum: List[Component]) -> List[Component]:
    return [
        Component(acceleration_component.frequency, acceleration_component.amplitude / (2 * pi * acceleration_component.frequency) ** 2)
        for acceleration_component in acceleration_spectrum if acceleration_component.frequency > 0
    ]


def get_max_component(spectrum: List[Component]):
    max_component: Component = None
    for i, component in enumerate(spectrum):
        if max_component is None or abs(component.amplitude) >= abs(max_component.amplitude):
            max_component = component

    return max_component


def peak_sum(spectrum: List[Component], center_frequency: float, n_pts: int) -> Component:
    index = None

    for i, component in enumerate(spectrum):
        if component.frequency == center_frequency:
            index = i
            break

    if index is None:
        return Component(0, 0)
    
    start_index = max(0, index - n_pts)
    end_index = min(len(spectrum), index + n_pts + 1)

    sum_component = Component(0, 0)

    for component in spectrum[start_index:end_index]:
        sum_component.frequency += component.frequency
        sum_component.amplitude += abs(component.amplitude)

    sum_component.frequency /= (end_index - start_index)

    return sum_component


def print_spectrum(spectrum: List[Component]):
    for component in spectrum:
        print(f'{component.frequency:5.2f}  {abs(component.amplitude):5.2f}')


class WaveAnalyzer:
    '''This class ingests a series of accelerations, and returns the primary wave height amplitude and frequency'''

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
        window_timespan = self.dt * len(self.accelerations)

        discrete_cosine_transform = dct(self.accelerations, norm='forward')
        acceleration_spectrum = get_components(discrete_cosine_transform, window_timespan)
        max_component = get_max_component(acceleration_spectrum)

        height_spectrum = acceleration_to_height(acceleration_spectrum)

        primary_component = peak_sum(height_spectrum, max_component.frequency, n_pts=4)

        return primary_component


if __name__ == '__main__':

    x = numpy.array([3 * cos(2 * pi * i / 10) ** 1.5 for i in range(0, 50)])

    wave_analyzer = WaveAnalyzer(100, 0.1)

    wave_analyzer.accelerations = list(x)
    print(wave_analyzer.wave())
