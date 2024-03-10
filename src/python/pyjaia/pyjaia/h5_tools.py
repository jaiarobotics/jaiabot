import h5py
from typing import *
import math
import numpy


INT32_MAX = (2 << 30) - 1
UINT32_MAX = (2 << 31) - 1


def get_root_item_path(path, root_item=''):
    '''Get the path to a root_item associated with that path'''
    components = path.split('/')
    components = components[:2] + [root_item]
    return '/'.join(components)


def h5_get_files(filenames):
    h5Files: h5py.File = []
    for fn in filenames:
        try:
            h5Files.append(h5py.File(fn))
        except OSError:
            continue
    return h5Files


def h5_get_string(string_dataset: h5py.Dataset, length_dataset: h5py.Dataset, index: int):
    """Gets a string from datasets in a Jaia HDF5 log file

    Args:
        string_dataset (h5py.Dataset): Dataset containing the characters (2-dimensional array dataset)
        length_dataset (h5py.Dataset): Dataset containing the length of each string (1-dimensional array dataset)
        index (int): Index of the string to return

    Returns:
        str: The stored string
    """
    length = length_dataset[index]
    string_bytes = bytes(string_dataset[index][:length])
    
    return string_bytes.decode('utf8')


def h5_get_bytes(bytes_dataset, length_dataset, index):
    length: int = length_dataset[index]
    return bytes(bytes_dataset[index][:length])


def h5_get_int(dataset, index):
    return int(dataset[index])


def h5_get_float(dataset, index):
    f = dataset[index]

    if math.isnan(f):
        return None
    else:
        return float(f)


def h5_get_series(dataset: h5py.Dataset):
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


def h5_get_enum_map(dataset: h5py.Dataset):
    """Get the enum map (enum_value -> enum_name dict) for an h5 dataset

    Args:
        dataset (h5py.Dataset): The dataset (hopefully an enum dataset)

    Returns:
        dict[int, str]: A dictionary mapping enum values to their corresponding user-readable enum names, or None if this is not an enum dataset
    """

    # Get the enum value names
    try:
        enum_names: List[str] = dataset.attrs['enum_names']
        enum_values: List[int] = dataset.attrs['enum_values']
        enum_dict = { int(enum_values[index]): enum_names[index] for index in range(0, len(enum_values))}
        return enum_dict

    except KeyError:
        return None


def h5_get_inverse_enum_map(dataset: h5py.Dataset):
    """Get the enum map (enum_name -> enum_value dict) for an h5 dataset

    Args:
        dataset (h5py.Dataset): The dataset (hopefully an enum dataset)

    Returns:
        dict[str, int]: A dictionary mapping enum names to their enum values, or None if this is not an enum dataset
    """
    m = h5_get_enum_map(dataset)
    
    if m is None:
        return None
    
    return {v: k for k, v in m.items()}
