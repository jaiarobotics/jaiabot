from dataclasses import field
import h5py
from objects import *
import logging
import math
import csv
import io
import datetime
import base64
from h5_tools import *


MOOS_MESSAGE_PATH = '/jaiabot::moos/jaiabot.protobuf.MOOSMessage'


def get_moos_messages(log_filenames: List[str], t_start: int=None, t_end: int=None) -> str:
    '''Gets a list of all the MOOSMessages from the logs in CSV format

    Args:
        log_filenames (List[str]): List of filenames of the logs
        t_start (int, optional): Start of the window (UNIX timestamp in microseconds). Defaults to None.
        t_end (int, optional): End of the time window (UNIX timestamp in microseconds). Defaults to None.

    Returns:
        str: All of the MOOS messages from the log files within the time range, dumped in CSV format.
    '''

    files = h5_get_files(log_filenames)

    # Write output csv to a string
    output_string_io = io.StringIO()
    fieldnames = ['date', '_utime_', 'key', 'value', 'community', 'source', 'source_aux', 'type']
    csv_writer = csv.DictWriter(output_string_io, fieldnames=fieldnames)
    csv_writer.writeheader()

    t_start = t_start or 0
    t_end = t_end or 9e99

    for file in files:
        moosmessage = file[MOOS_MESSAGE_PATH]

        moosmessage_type = moosmessage['type']
        moosmessage_type_enum_dict = h5_get_inverse_enum_map(moosmessage_type)
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
                type = 'TYPE_STRING'
                value = h5_get_string(moosmessage['svalue'], moosmessage['svalue_size'], moosmessage_index)

            elif moosmessage_type[moosmessage_index] == MOOSMESSAGE_TYPE_DOUBLE:
                type = 'TYPE_DOUBLE'
                value = h5_get_float(moosmessage['dvalue'], moosmessage_index)

            elif moosmessage_type[moosmessage_index] == MOOSMESSAGE_TYPE_BINARY_STRING:
                type = 'TYPE_BINARY_STRING'
                data = h5_get_bytes(moosmessage['bvalue'], moosmessage['bvalue_size'], moosmessage_index)
                value = base64.b64encode(data)

            source = h5_get_string(moosmessage['source'], moosmessage['source_size'], moosmessage_index)
            source_aux = h5_get_string(moosmessage['source_aux'], moosmessage['source_aux_size'], moosmessage_index)
            community = h5_get_string(moosmessage['community'], moosmessage['community_size'], moosmessage_index)

            date = datetime.datetime.fromtimestamp(_utime_ / 1e6).isoformat('_')

            csv_writer.writerow({
                'date': date,
                '_utime_': _utime_,
                'key': key,
                'value': value,
                'source': source,
                'source_aux': source_aux,
                'community': community
            })
 
    return output_string_io.getvalue()
