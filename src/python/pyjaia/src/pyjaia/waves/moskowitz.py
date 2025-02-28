from typing import *
from math import *
import numpy
import random


# Source: https://wikiwaves.org/Ocean-Wave_Spectra, Pierson and Moscowitz (1964)
alpha = 8.1e-3 # unitless
beta = 0.74 # unitless
g = 9.8 # m/s^2


def moscowitzS(f: float, U19_5: float):
    """Returns the power spectral density for the Moscowitz model for a "fully developed sea."

    Args:
        f (float): Frequency (Hz) for which to get the power spectral density.
        U19_5 (float): Wind speed at 19.5 meters above the ocean surface.

    Returns:
        float: The spectral power density at frequency `f`.
    """
    omega_0 = g / U19_5 # s^-1
    omega = 2 * pi * f
    S = (alpha * g * g) / (omega ** 5) * exp(-beta * (omega_0 / omega) ** 4) # m^2 * s
    Sf = 2 * pi * S # We want the power spectral density versus frequency
    return Sf



def generateMoscowitz(N: int, sampleFrequency: float, U19_5: float=6.0) -> List[float]:
    """Generates an acceleration time series using the Moscowitz model for a "fully developed sea."

    Args:
        N (int): Total number of data points.
        sampleFrequency (float): Sample frequency of the data.
        U19_5 (float): Wind speed at 19.5 meters above surface of ocean.

    Returns:
        List[float]: An acceleration time series for the resulting waves.
    """
    # Source: https://wikiwaves.org/Ocean-Wave_Spectra, Pierson and Moscowitz (1964)
    A: List[float] = [0.0] * N # acceleration spectrum (m / s^2 / Hz)

    for i in range(1, N // 2 + 1):
        f = i * sampleFrequency / N
        # Get PSD at this frequency
        S = moscowitzS(f, U19_5)
        # Convert to amplitude of this frequency
        amplitude = sqrt(N // 2 * sampleFrequency * S)
        # Give a random phase
        amplitude *= numpy.exp(-(1j) * random.uniform(0, 2 * pi))
        # Convert to acceleration
        acceleration = amplitude * (4 * pi**2 * f**2)

        A[i] += acceleration
        A[N - i] += numpy.conj(acceleration)
    
    acceleration = numpy.fft.ifft(numpy.array(A))
    acceleration = numpy.real(acceleration)

    omega_P = 0.877 * 9.8 / U19_5
    print(f'Peak Frequency = {omega_P / (2 * pi)} Hz')
    swh = 0.21 * (U19_5 ** 2) / g
    print(f'Significant wave height = {swh} m')

    return list(acceleration)


