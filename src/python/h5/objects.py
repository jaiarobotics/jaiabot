from typing import *

import numpy
import cmath
import h5py

def get_leaf(dataset: h5py.Dataset, indices):
    '''Gets the leaf data as a python object, from a dataset, indexing into it using the indices list'''
    attrs = dataset.attrs

    while len(indices) > 0:
        dataset = dataset[indices[0]]
        indices = indices[1:]

    if isinstance(dataset, numpy.integer):
        val = int(dataset)
        if val == numpy.iinfo(dataset.dtype).max:
            return None
        else:
            # Is it an enum?
            if 'enum_values' in attrs:
                index = numpy.where(attrs['enum_values'] == val)
                return attrs['enum_names'][index][0]

            return val

    if isinstance(dataset, numpy.floating):
        val = float(dataset)
        if cmath.isnan(val):
            return None
        else:
            return val

    if isinstance(dataset, numpy.ndarray):
        # If this is an array of int8, then try to load it as a string
        if dataset.dtype == 'int8' or dataset.dtype == 'uint8':
            bytes_value = b''
            
            for i in dataset:
                if i == 0:
                    break
                bytes_value += i

            return bytes_value.decode('utf8')

        return dataset.tolist()
    
    raise Exception(f'Cannot convert to JSON serializable, type = ' + str(type(dataset)))


def jaialog_get_object(group, repeated_members, item_indices):
    '''Gets a single object from an h5 group'''
    try:
        keys = group.keys()
    except AttributeError as e:
        print(e)
        print(f'Does one of "{group.name}" need to be added to repeated_members?')
        exit(1)

    new_item = {}

    for key in keys:
        raw_value = group[key]

        try:
            value = get_leaf(raw_value, item_indices)

        except TypeError:
            # This is a group
            if key in repeated_members:
                value = jaialog_get_object_list(raw_value, repeated_members, item_indices)
            else:
                value = jaialog_get_object(raw_value, repeated_members, item_indices)

        if value is not None:
            new_item[key] = value

    # Empty object, so return None
    if len(new_item) == 0:
        return None

    return new_item


def jaialog_get_object_list(group, repeated_members=set(), indices=[]):
    '''Gets a list of objects from an h5 group'''
    items: List[dict] = []

    item_index = 0

    while True:
        try:
            new_item = jaialog_get_object(group, repeated_members, indices + [item_index])
            item_index += 1
            if new_item is not None:
                items.append(new_item)
        except IndexError:
            break

    return items

