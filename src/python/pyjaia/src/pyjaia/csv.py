import csv
import io
from typing import Iterable, Any
import datetime

from google.protobuf.json_format import MessageToDict

from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
from jaiabot.messages.mission_pb2 import MissionTask


def utime_to_string(utime: int):
    # Convert microseconds to seconds
    timestamp_seconds = utime / 1e6
    # Create a datetime object from the timestamp
    dt = datetime.datetime.fromtimestamp(timestamp_seconds)
    # Format the datetime as a string
    return dt.strftime('%Y-%m-%d %H:%M:%S')


def flatten_dict(input: dict, prefix=''):
    output = {}
    first_keys = ['bot_id', 'start_time', 'end_time', 'type']
    other_keys = input.keys() - first_keys

    for key in first_keys + list(other_keys):
        value = input.get(key)
        if value is None:
            continue

        if key.endswith('_time'):
            output[prefix + key] = utime_to_string(int(value))
        elif isinstance(value, (int, float, str)):
            output[prefix + key] = value
        elif isinstance(value, bool):
            output[prefix + key] = 'YES' if value else 'NO'
        elif isinstance(value, dict):
            output.update(flatten_dict(value, prefix + key + '.'))
        else:
            print(f'Warning: Skipping key {prefix + key} with unsupported type {type(value)}')
    return output


def task_packets_to_csv(task_packets: Iterable[TaskPacket]):
    csv_string_io = io.StringIO(newline='') # Use newline='' as recommended for the csv module

    packet_dicts = [flatten_dict(MessageToDict(packet, preserving_proto_field_name=True)) for packet in task_packets]
    if len(packet_dicts) == 0:
        return "No task packets."

    # Get all field names
    union_dict = {}
    for packet_dict in packet_dicts:
        union_dict.update(packet_dict)
    fieldnames = list(union_dict.keys())
    print(fieldnames)

    writer = csv.DictWriter(csv_string_io, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(packet_dicts)

    return csv_string_io.getvalue()
