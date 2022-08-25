import h5py
from .objects import *
import logging
import math


def h5_get_files(filenames):
    return [h5py.File(fn) for fn in filenames]


def h5_get_enum_dict(dataset):
    '''Get the enum dictionary for a dataset'''

    enum_names = dataset.attrs['enum_names']
    enum_values = dataset.attrs['enum_values']
    return { enum_names[index]: int(enum_values[index]) for index in range(0, len(enum_values))}


def h5_get_string(string_dataset, length_dataset, index):
    length = length_dataset[index]

    string_bytes = b''
    string_int_array = string_dataset[index]
    for i in range(length):
        string_bytes += string_int_array[i]
    
    return string_bytes.decode('utf8')


def h5_get_bytes(bytes_dataset, length_dataset, index):
    length = length_dataset[index]

    string_bytes = b''
    string_int_array = string_dataset[index]
    for i in range(length):
        string_bytes += string_int_array[i]
    
    return string_bytes


def h5_get_int(dataset, index):
    return int(dataset[index])


def h5_get_float(dataset, index):
    f = dataset[index]

    if math.isnan(f):
        return None
    else:
        return float(f)


MOOS_MESSAGE_PATH = '/jaiabot::moos/jaiabot.protobuf.MOOSMessage'


def get_moos_messages(log_filenames, t_start, t_end):
    '''Gets a list of all the MOOSMessages from the logs'''

    files = h5_get_files(log_filenames)

    messages = []

    for file in files:
        moosmessage = file[MOOS_MESSAGE_PATH]

        moosmessage_type = moosmessage['type']
        moosmessage_type_enum_dict = h5_get_enum_dict(moosmessage_type)
        MOOSMESSAGE_TYPE_DOUBLE = moosmessage_type_enum_dict['TYPE_DOUBLE']
        MOOSMESSAGE_TYPE_STRING = moosmessage_type_enum_dict['TYPE_STRING']
        MOOSMESSAGE_TYPE_BINARY_STRING = moosmessage_type_enum_dict['TYPE_BINARY_STRING']

        moosmessage__utime_ = moosmessage['_utime_']

        for moosmessage_index in range(len(moosmessage_type)):
            _utime_ = h5_get_int(moosmessage__utime_, moosmessage_index)
            if _utime_ < t_start:
                continue
            if _utime_ > t_end:
                break

            key = h5_get_string(moosmessage['key'], moosmessage['key_size'], moosmessage_index)

            if moosmessage_type[moosmessage_index] == MOOSMESSAGE_TYPE_STRING:
                value = h5_get_string(moosmessage['svalue'], moosmessage['svalue_size'], moosmessage_index)

            elif moosmessage_type[moosmessage_index] == MOOSMESSAGE_TYPE_DOUBLE:
                value = h5_get_float(moosmessage['dvalue'], moosmessage_index)

            elif moosmessage_type[moosmessage_index] == MOOSMESSAGE_TYPE_BINARY_STRING:
                value = h5_get_bytes(moosmessage['bvalue'], moosmessage['bvalue_size'], moosmessage_index)

            source = h5_get_string(moosmessage['source'], moosmessage['source_size'], moosmessage_index)
            source_aux = h5_get_string(moosmessage['source_aux'], moosmessage['source_aux_size'], moosmessage_index)
            community = h5_get_string(moosmessage['community'], moosmessage['community_size'], moosmessage_index)

            messages.append({
                '_utime_': _utime_,
                'key': key,
                'value': value,
                'source': source,
                'source_aux': source_aux,
                'community': community
            })
 
    return messages
