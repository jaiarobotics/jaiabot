from .types import *
from copy import deepcopy
from math import *


def applyWindow(series: Series, config: WindowConfig):
    """Apply the specified window config to the time series.

    Args:
        series (Series): Input time series.
        config (WindowConfig): Configuration specifying type of windowing function to apply.

    Returns:
        Series: The windowed time series.
    """
    window = getWindow(config, series.duration().total_seconds(), series.averageSampleFrequency())

    new_series = deepcopy(series)
    new_series.y_values = [window[index] * value for index, value in enumerate(series.y_values)]
    return new_series


def getWindow(config: WindowConfig, duration: float, sampleFreq: float):
    if config.type == 'none':
        return getNoneWindow(duration, sampleFreq)
    elif config.type == 'tukey':
        return getTukeyWindow(config, duration, sampleFreq)
    elif config.type == 'hann':
        return getHannWindow(config, duration, sampleFreq)
    else:
        print(f'Unknown window type: {config.type}')
        exit(1)


def getNoneWindow(duration: float, sampleFreq: float):
    return [1.0] * int(duration / sampleFreq)


def getTukeyWindow(config: WindowConfig, duration: float, sampleFreq: float):
    """Get a Tukey window for a series.

    Args:
        series (Series): Input series.
        config (WindowConfig): Configuration object, (with duration).

    Returns:
        Collection[float]: The resulting window.
    """

    t = 0
    window: List[float] = []

    while t < duration:
        if t < config.duration:
            s = 0.5 - 0.5 * cos((t) * pi / config.duration)
            k = s * s
            window.append(k)

        elif t > duration - config.duration:
            s = 0.5 - 0.5 * cos((duration - t) * pi / config.duration)
            k = s * s
            window.append(k)

        else:
            window.append(1.0)

        t += 1.0 / sampleFreq

    return window


def getHannWindow(config: WindowConfig, duration: float, sampleFreq: float):
    """Gets a Hann window, which is a special case of the Tukey window.

    Args:
        series (Series): Input series.
        config (WindowConfig): Configuration object.

    Returns:
        Collection[float]: The resulting window.
    """
    return getTukeyWindow(WindowConfig('tukey', duration / 2.0), duration, sampleFreq)


def getMeanSquareOfWindow(config: WindowConfig, duration: float, sampleFreq: float):
    """Return mean square of the windowing function, to renormalize the power density spectrum, etc.

    Args:
        series (Series): Time series of data that is windowed.
        config (WindowConfig): Configuration specifying window type and parameters.

    Returns:
        float: The mean square value of the window's coefficients, to use for re-normalizing quantities like the PDS.
    """
    window = getWindow(config, duration, sampleFreq)
    return sum([x*x for x in window]) / len(window)

