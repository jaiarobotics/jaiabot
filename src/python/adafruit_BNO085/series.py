from dataclasses import dataclass
from math import *
import logging
import copy
import bisect
from typing import *
from datetime import *
import statistics


UnixTimeMicroseconds = int

@dataclass
class TimeRange:
    start: UnixTimeMicroseconds
    end: UnixTimeMicroseconds

    def duration(self):
        return timedelta(microseconds=(self.end - self.start))
    
    @staticmethod
    def fromDatetimes(start: datetime, end: datetime):
        return TimeRange(start.timestamp() * 1e6, end.timestamp() * 1e6)

    def __contains__(self, time: UnixTimeMicroseconds):
        return time > self.start and time < self.end


def floatRange(start: float, end: float, delta: float):
    x = start

    while x < end:
        yield x
        x += delta


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
        self.utime = []
        self.y_values = []

    def cleared(self):
        series = Series()
        series.name = self.name
        series.utime = []
        series.y_values = []
        series.hovertext = []

        return series

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

    def get(self, index):
        return (self.utime[index], self.y_values[index])

    def appendPair(self, pair: Iterable[float]):
        self.utime.append(pair[0])
        self.y_values.append(pair[1])

    def count(self):
        return len(self.utime)

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

    def duration(self):
        datetimeList = self.datetimes()
        if len(datetimeList) < 1:
            return timedelta(0)
        return datetimeList[-1] - datetimeList[0]
    

    def slice(self, timeRange: TimeRange):
        seriesSlice = Series()
        seriesSlice.name = self.name
        seriesSlice.hovertext = self.hovertext

        for index, utime in enumerate(self.utime):
            if utime >= timeRange.start and utime < timeRange.end:
                seriesSlice.utime.append(utime)
                seriesSlice.y_values.append(self.y_values[index])

        return seriesSlice


    def makeUniform(self, freq: float):
        '''Returns a new Series object using this Series\' data, sampled at a constant frequency and suitable for an Fourier-type transform'''
        newSeries = Series()
        newSeries.name = self.name
        newSeries.hovertext = self.hovertext

        if len(self.utime) == 0:
            return newSeries
        
        for utime in floatRange(self.utime[0] + 1, self.utime[-1], 1e6 / freq):
            newSeries.utime.append(utime)
            newSeries.y_values.append(self.getValueAtTime(utime, interpolate=True))

        return newSeries

