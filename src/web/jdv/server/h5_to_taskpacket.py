#!/usr/bin/env python3

from typing import *
from pprint import *
from datetime import *

import web.jdv.server.jaialog_store as jaialog_store
import taskpacketfile
import argparse
import dateutil.parser
import dateutil.tz


parser = argparse.ArgumentParser(description='Extract task packets from a Jaia HDF5 log file')
parser.add_argument('-t', dest="start_time", help='Time and/or date to reset the first taskpacket to (for debugging)')
parser.add_argument("input_filenames", nargs='+', help="Path(s) of input HDF5 file(s)")
parser.add_argument("output_filename", help='Path of output taskpacket file')

args = parser.parse_args()

# Utils

def from_utime(utime: int):
    return datetime.fromtimestamp(int(utime / 1e6), tz=dateutil.tz.UTC)

def to_utime(dt: timedelta):
    return int(dt.total_seconds() * 1e6)

####


task_packets = jaialog_store.get_task_packets(args.input_filenames)

if args.start_time is not None:
    start_time = dateutil.parser.parse(args.start_time).astimezone(dateutil.tz.UTC)
    print(f'Resetting to {start_time}')

    delta = None
    for packet in task_packets:
        if delta is None:
            delta = to_utime(start_time - from_utime(packet.start_time))

        packet.start_time += delta
        packet.end_time += delta
        packet._utime_ += delta

print(f'Writing to {args.output_filename}')
taskpacketfile.write_file(task_packets, args.output_filename)
