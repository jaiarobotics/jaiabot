from math import *
from h5py import *
import numpy

INT32_MAX = (2 << 30) - 1
UINT32_MAX = (2 << 31) - 1

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
