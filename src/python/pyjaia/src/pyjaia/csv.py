import csv
import io
from typing import Iterable
import datetime

from google.protobuf.json_format import MessageToDict

from jaiabot.messages.jaia_dccl_pb2 import TaskPacket


def utime_to_string(utime: int):
    # Convert microseconds to seconds
    timestamp_seconds = utime / 1e6
    # Create a datetime object from the timestamp
    dt = datetime.datetime.fromtimestamp(timestamp_seconds)
    # Format the datetime as a string
    return dt.strftime('%Y-%m-%d %H:%M:%S')


def flatten_dict(input: dict, prefix=''):
    """Flattens a dictionary with possible nested dictionaries into one.  The nested paths use dot notation, i.e. "object1.field1" for their keys.
    
    We also want to keep certain keys first in the output dict (bot_id, start_time, end_time, type).  
    
    We're using the fact that dicts are ordered in Python 3.7+ to ensure these keys come first in the output CSV.

    Args:
        input (dict): The dictionary to flatten.
        prefix (str, optional): The prefix to use for nested keys. Defaults to ''.

    Returns:
        dict: The flattened dictionary.
    """
    output = {}
    first_keys = ['bot_id', 'start_time', 'end_time', 'type']
    other_keys = [key for key in input.keys() if key not in first_keys]

    for key in first_keys + list(other_keys):
        value = input.get(key)
        if value is None:
            continue

        if key.endswith('_time'):
            output[prefix + key] = utime_to_string(int(value))
        elif isinstance(value, bool):
            output[prefix + key] = 'YES' if value else 'NO'
        elif isinstance(value, (int, float, str)):
            output[prefix + key] = value
        elif isinstance(value, dict):
            output.update(flatten_dict(value, prefix + key + '.'))
        else:
            pass
    return output


def task_packets_to_csv(task_packets: Iterable[TaskPacket]):
    csv_string_io = io.StringIO(newline='') # Use newline='' as recommended for the csv module

    packet_dicts = [flatten_dict(MessageToDict(packet, preserving_proto_field_name=True)) for packet in task_packets]
    if len(packet_dicts) == 0:
        return "No task packets."

    # Get all field names
    # We will take the union of all keys across all packet dicts to ensure we have a complete set of columns for the CSV
    # We are using a dict instead of a set to preserve order (insertion order is preserved in Python 3.7+)
    # We want the columns to be in a consistent order, with the first keys (bot_id, start_time, end_time, type) appearing first if they exist in any packet
    union_dict = {}
    for packet_dict in packet_dicts:
        union_dict.update(packet_dict)
    fieldnames = list(union_dict.keys())

    writer = csv.DictWriter(csv_string_io, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(packet_dicts)

    return csv_string_io.getvalue()
