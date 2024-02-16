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


def utimeToDatetime(utime: float):
    return datetime.fromtimestamp(utime / 1e6)


def floatRange(start: float, end: float, delta: float):
    x = start

    while x < end:
        yield x
        x += delta


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


    def blacklistTimePeriods(self, blacklist: List[TimeRange]):
        newSeries = copy.deepcopy(self)
        newSeries.clear()

        for index, utime in enumerate(self.utime):
            include = True
            for timeRange in blacklist:
                if utime in timeRange:
                    include = False
                    break
            if include:
                newSeries.utime.append(utime)
                newSeries.y_values.append(self.y_values[index])

        return newSeries

from h5py import *


def h5_get_series(dataset: Dataset):
    '''Get a filtered, JSON-serializable representation of an h5 dataset'''
    dtype: numpy.dtype = dataset.dtype

    def from_float(x):
        x = float(x)
        if isnan(x):
            return None
        return x

    def from_int32(x):
        if x == INT32_MAX:
            return None
        return int(x)

    def from_uint32(x):
        if x == UINT32_MAX:
            return None
        return int(x)

    dtype_proc = {
        'f': from_float,
        'i': from_int32,
        'u': from_uint32
    }

    map_proc = dtype_proc[dtype.kind]
    filtered_list = [map_proc(x) for x in dataset]

    return filtered_list


def h5_get_hovertext(dataset: Dataset):
    '''Get the hovertext for an h5 dataset'''

    # Get the enum value names
    try:
        enum_names = dataset.attrs['enum_names']
        enum_values = dataset.attrs['enum_values']
        enum_dict = { int(enum_values[index]): enum_names[index] for index in range(0, len(enum_values))}
        return enum_dict

    except KeyError:
        return None


def readSeriesFromHDF5File(log: File=None, path: str=None, scheme=1, invalid_values: set=set(), name: str=None):
    series = Series()

    # Strip initial '/' character
    if path is not None and path[0] == '/' and len(path) > 1:
        path = path[1:]

    if name is not None:
        series.name = name
    elif path is not None:
        series.name = path.split('/')[-1]
    else:
        series.name = ''

    series.utime = []
    series.y_values = []
    series.hovertext = {}

    if log:
        try:
            _utime__array = log[get_root_item_path(path, '_utime_')]
            _scheme__array = log[get_root_item_path(path, '_scheme_')]
            path_array = log[path]

            data = zip(h5_get_series(_utime__array), h5_get_series(_scheme__array), h5_get_series(path_array))
            data = filter(lambda pt: pt[1] == scheme and pt[2] not in invalid_values, data)

            series.utime, schemes, series.y_values = zip(*data)
        except (ValueError, KeyError):
            logging.warning(f'No valid data found for log: {log.filename}, series path: {path}')
            series.utime = []
            series.schemes = []
            series.y_values = []
            series.hovertext = {}

            return series

        series.hovertext = h5_get_hovertext(log[path]) or {}

    return series
