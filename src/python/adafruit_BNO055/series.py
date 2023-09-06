from dataclasses import dataclass
from math import *
import logging
import copy
import bisect
from typing import *
from datetime import *
import statistics


def utimeToDatetime(utime: float):
    return datetime.fromtimestamp(utime / 1e6)


INT32_MAX = (2 << 30) - 1
UINT32_MAX = (2 << 31) - 1


def get_root_item_path(path, root_item=''):
    '''Get the path to a root_item associated with that path'''
    components = path.split('/')
    components = components[:2] + [root_item]
    return '/'.join(components)


def significantWaveHeight(waveHeights: List[float]):
    if len(waveHeights) == 0:
        return 0.0

    sortedWaveHeights = sorted(waveHeights)
    N = floor(len(sortedWaveHeights) * 2 / 3)
    significantWaveHeights = sortedWaveHeights[N:]

    return statistics.mean(significantWaveHeights)


@dataclass
class Series:
    name: str
    utime: List[float]
    y_values: List[float]
    hovertext: dict

    def __init__(self, name: str = None) -> None:
        self.name = name or ''
        self.utime = []
        self.y_values = []
        self.hovertext = {}

    def clear(self):
        self.utime.clear()
        self.y_values.clear()

    def __add__(self, other_series: 'Series'):
        r = copy.copy(self)
        r.y_values = [other_series.y_values[index] + self.y_values[index] for index in range(len(self.y_values))]
        return r
    
    def __mult__(self, other_series: 'Series'):
        r = copy.copy(self)
        r.y_values = [other_series.y_values[index] * self.y_values[index] for index in range(len(self.y_values))]
        return r

    def __repr__(self) -> str:
        try:
            duration = self.utime[-1] - self.utime[0]
        except IndexError:
            duration = 0
        return f'<Series "{self.name}" values={len(self.utime)} duration={duration / 1e6:0.02f} sec>'

    def append(self, utime: float, value: float):
        self.utime.append(utime)
        self.y_values.append(value)

    def sort(self):
        if len(self.utime) > 0 and len(self.y_values) > 0:
            self.utime, self.y_values = zip(*sorted(zip(self.utime, self.y_values)))
        else:
            logging.warning(f'Not enough values to sort.  len(utime) = {len(self.utime)}, len(y_values) = {len(self.y_values)}')

    def getValueAtTime(self, utime: float, interpolate: bool=False):
        index = bisect.bisect_left(self.utime, utime)
        if index == 0:
            return None
        else:
            # Now interpolate between values
            if interpolate and index > 0 and index < len(self.y_values) - 1:
                return self.y_values[index - 1] + (utime - self.utime[index - 1]) * (self.y_values[index] - self.y_values[index - 1]) / (self.utime[index] - self.utime[index - 1])

            return self.y_values[index - 1]
        
        
    def getLastUtimeBefore(self, utime: float):
        index = bisect.bisect_left(self.utime, utime)
        if index == 0:
            return None
        else:
            return self.utime[index - 1]
        
    def datetimes(self):
        return [datetime.fromtimestamp(utime / 1e6) for utime in self.utime]

    def plot(self):
        import plotly.express as px
        fig = px.line(x=self.datetimes(), y=self.y_values, markers=True)
        fig.show()

    def getSubSeriesList(self, filterFunc: Callable[[float, float], bool]):
        '''Returns a list of subseries, where the filterFunc returns true for each (utime, y_value) pair.  When it returns false, a series will end, and when it returns true again a new series will start.'''
        subseries: list[Series] = []

        newSeries = Series()
        newSeries.name = self.name

        for index in range(len(self.utime)):

            shouldInclude = filterFunc(self.utime[index], self.y_values[index])

            if shouldInclude:
                newSeries.utime.append(self.utime[index])
                newSeries.y_values.append(self.y_values[index])
            else:
                if len(newSeries.utime) > 0:
                    subseries.append(newSeries)
                    newSeries = Series()
                    newSeries.name = self.name

        return subseries

    def duration(self):
        datetimeList = self.datetimes()
        if len(datetimeList) < 1:
            return timedelta(0)
        return datetimeList[-1] - datetimeList[0]
    