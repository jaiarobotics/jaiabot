from dataclasses import dataclass
from math import *
from typing import *
from scipy.fft import dct, fft
import numpy
from vector3 import Vector3


@dataclass
class Component:
    frequency: float
    height: float


def get_components(input_dct: List[float], window_time_length: float):
    return [
        Component(i / 2 / window_time_length, height=2 * x)
        for i, x in enumerate(input_dct)
    ]


def sort_by_amplitude(spectrum: List[Component]) -> List[Component]:
    return list(sorted(spectrum, key=lambda component: abs(component.height), reverse=True))


def acceleration_to_height(acceleration_spectrum: List[Component]) -> List[Component]:
    return [
        Component(acceleration_component.frequency, acceleration_component.height / (2 * pi * acceleration_component.frequency) ** 2)
        for acceleration_component in acceleration_spectrum if acceleration_component.frequency > 0
    ]


def get_max_component(spectrum: List[Component]):
    max_component: Component = None
    for i, component in enumerate(spectrum):
        if max_component is None or abs(component.height) >= abs(max_component.height):
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
        sum_component.height += abs(component.height)

    sum_component.frequency /= (end_index - start_index)

    return sum_component


def print_spectrum(spectrum: List[Component]):
    for component in spectrum:
        print(f'{component.frequency:5.2f}  {abs(component.height):5.2f}')


class Analyzer:
    '''
        This class ingests a series of accelerations, and returns:
        a) the primary wave height amplitude and frequency
        b) the maximum acceleration (for bottom type characterization)
    '''

    acceleration_z: List[float] = []
    acceleration_mag: List[float] = []
    max_points = 100
    dt: float


    def __init__(self, max_points: int, dt: float) -> None:
        self.max_points = max_points
        self.dt = dt


    def addAcceleration(self, acceleration: Vector3):
        self.acceleration_z.append(acceleration.z)
        self.acceleration_mag.append(acceleration.magnitude())

        if len(self.acceleration_z) > self.max_points:
            self.acceleration_z.pop(0)
            self.acceleration_mag.pop(0)


    def wave(self) -> Component:

        # Guard against empty array
        if len(self.acceleration_z) == 0:
            return Component(0, 0)

        window_timespan = self.dt * len(self.acceleration_z)

        discrete_cosine_transform = dct(self.acceleration_z, norm='forward')
        acceleration_spectrum = get_components(discrete_cosine_transform, window_timespan)
        max_component = get_max_component(acceleration_spectrum)

        height_spectrum = acceleration_to_height(acceleration_spectrum)

        primary_component = peak_sum(height_spectrum, max_component.frequency, n_pts=4)

        return primary_component


    def maxAcceleration(self) -> float:
        '''Return the maximum acceleration amplitude acheived in the sample window'''
        try:
            return max(self.acceleration_mag)
        except ValueError:
            # Empty sequence?
            return 0


if __name__ == '__main__':

    x = numpy.array([3 * cos(2 * pi * i / 10) for i in range(0, 50)])
    print(x)
    wave_analyzer = Analyzer(max_points=100, dt=0.1)

    wave_analyzer.acceleration_z = list(x)
    wave_analyzer.acceleration_mag = [abs(z) for z in x]
    print(f'Wave Component: {wave_analyzer.wave()}')
    print(f'maxAcceleration: {wave_analyzer.maxAcceleration()}')

