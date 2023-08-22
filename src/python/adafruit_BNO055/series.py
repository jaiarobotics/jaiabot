from dataclasses import dataclass
from math import *
import logging
import copy
import bisect
from typing import *
from datetime import datetime
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

    def __init__(self) -> None:
        self.name = ''
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

    def sort(self):
        if len(self.utime) > 0 and len(self.y_values) > 0:
            self.utime, self.y_values = zip(*sorted(zip(self.utime, self.y_values)))
        else:
            logging.warning(f'Not enough values to sort.  len(utime) = {len(self.utime)}, len(y_values) = {len(self.y_values)}')

    def getValueAtTime(self, utime: float):
        index = bisect.bisect_left(self.utime, utime)
        if index == 0:
            return None
        else:
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

    def sortedWaveHeights(self):
        waveHeights = []
        y = self.y_values

        trough = None
        peak = None

        direction = 0 # +1 for up, 0 for stationary, -1 for down

        # Find waves
        for index, y in enumerate(self.y_values):
            if index == 0:
                continue
            
            y0 = self.y_values[index - 1]

            oldDirection = direction

            if y > y0:
                direction = 1
            elif y < y0:
                direction = -1

            if direction == 1 and oldDirection == -1:
                trough = y0
            if direction == -1 and oldDirection == 1 and trough is not None:
                peak = y0

            if peak is not None and trough is not None:
                waveHeights.append(peak - trough)
                peak = None
                trough = None

        sortedWaveHeights = sorted(waveHeights)

        return sortedWaveHeights

    def filter(self, filterFunc: Callable[[float, float], bool], defaultValue: float = 0.0):
        newUtime = []
        newY = []
        for index, utime in enumerate(self.utime):
            newUtime.append(utime)
            if filterFunc(utime, self.y_values[index]):
                newY.append(self.y_values[index])
            else:
                newY.append(defaultValue)
        
        self.utime = newUtime
        self.y_values = newY

        return self

    def duration(self):
        datetimeList = self.datetimes()
        return datetimeList[-1] - datetimeList[0]
    

    @staticmethod
    def magnitude(seriesList: List, name: str = 'No Name'):
        series = Series()
        series.name = name

        for index in range(len(seriesList[0].utime)):
            series.utime.append(seriesList[0].utime[index])
            mag2 = sum([series.y_values[index]**2 for series in seriesList])
            series.y_values.append(sqrt(mag2))
        return series
    
