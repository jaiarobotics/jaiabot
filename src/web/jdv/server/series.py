from dataclasses import dataclass
import math
from h5py import Dataset
import numpy
import logging
import copy
import bisect


INT32_MAX = (2 << 30) - 1
UINT32_MAX = (2 << 31) - 1


def get_root_item_path(path, root_item=''):
    '''Get the path to a root_item associated with that path'''
    components = path.split('/')
    components = components[:2] + [root_item]
    return '/'.join(components)


def h5_get_series(dataset: Dataset):
    '''Get a filtered, JSON-serializable representation of an h5 dataset'''
    dtype: numpy.dtype = dataset.dtype

    def from_float(x):
        x = float(x)
        if math.isnan(x):
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


@dataclass
class Series:
    utime: list
    y_values: list
    hovertext: dict

    def __init__(self, log=None, path=None, scheme=1, invalid_values=set()) -> None:
        self.utime = []
        self.y_values = []
        self.hovertext = {}

        if log:
            try:
                _utime__array = log[get_root_item_path(path, '_utime_')]
                _scheme__array = log[get_root_item_path(path, '_scheme_')]
                path_array = log[path]

                series = zip(h5_get_series(_utime__array), h5_get_series(_scheme__array), h5_get_series(path_array))
                series = filter(lambda pt: pt[1] == scheme and pt[2] not in invalid_values, series)

                self.utime, schemes, self.y_values = zip(*series)
            except (ValueError, KeyError):
                logging.warning(f'No valid data found for log: {log.filename}, series path: {path}')
                self.utime = []
                self.schemes = []
                self.y_values = []
                self.hovertext = {}

                return

            self.hovertext = h5_get_hovertext(log[path]) or {}

    def __add__(self, other_series: 'Series'):
        r = copy.copy(self)
        r.utime += list(other_series.utime)
        r.y_values += list(other_series.y_values)
        r.hovertext.update(other_series.hovertext)
        return r

    def sort(self):
        if len(self.utime) > 0 and len(self.y_values) > 0:
            self.utime, self.y_values = zip(*sorted(zip(self.utime, self.y_values)))
        else:
            logging.warning(f'Not enough values to sort.  len(utime) = {len(self.utime)}, len(y_values) = {len(self.y_values)}')

    def getValueAtTime(self, t):
        index = bisect.bisect_left(self.utime, t)
        if index == 0:
            return None
        else:
            return self.y_values[index - 1]


