#!/usr/bin/env python3

import argparse
import os
from dataclasses import *
from typing import *
from pyjaia.arguments import add_arguments
from pyjaia.series import *
from pyjaia.log_file import *
from pyjaia.csv_tools import *
from pyjaia.utils import *
from pyjaia.h5_tools import *
from jaiabot.messages.mission_pb2 import MissionState

@dataclass
class Args:
    hdf5_file: str = None
    _hdf5_file_argparse = {'help': 'the HDF5 input file'}

    data_paths: List[str] = None
    _data_paths_argparse = {'nargs': '+', 'help': 'data paths (supports regex) to output to columns in the CSV file (must be from the same message)'}

    split_mission_state: str = None
    _split_mission_state_argparse = {'flags': ['-s'], 'help': 'split the series into segments where the mission_state matches a given regex'}

    list_data_paths: bool = None
    _list_data_paths_argparse = {'flags': ['-l'], 'action': 'store_true', 'help': 'just list the data paths matching the data_paths parameters'}


def main():
    parser = argparse.ArgumentParser(os.path.basename(__file__), description='Extract CSV files from Jaia HDF5 logs')
    add_arguments(parser, Args())
    args: Args = parser.parse_args()

    log_file = LogFile(args.hdf5_file)

    # Just list data paths
    if args.list_data_paths:
        for data_path_pattern in args.data_paths:
            for data_path in log_file.get_paths_matching(data_path_pattern):
                print(data_path)
        exit(0)

    # Export csv file(s)
    # Get all of the series
    series_list: List[Series] = []
    for data_path_re in args.data_paths:
        series_list.extend(log_file.get_series_matching(data_path_re))

    # Ensure that they are all from the same object
    object_path = None
    for series in series_list:
        if object_path is None:
            object_path = series.object_path
        else:
            assert(object_path == series.object_path)

    sanitized_data_path = sanitize_filename(h5_simplified_data_path(object_path))

    # Split into separate series, if necessary
    if args.split_mission_state is not None:
        # Find the desired mission state value(s)
        mission_states: Set[int] = set()
        for item in MissionState.items():
            if item[0].find(args.split_mission_state) != -1:
                mission_states.add(item[1])

        mission_state = log_file.get_series_matching('mission_state')[0]
        time_ranges = mission_state.getTimeRanges(where=lambda pt: pt.y_value in mission_states)

        for segment_index, time_range in enumerate(time_ranges):
            segments = [ series.slice(time_range) for series in series_list ]
            filename = f'{sanitized_data_path}-{segment_index + 1}.csv'
            write_series_to_csv(segments, filename)

    else:
        filename = f'{sanitized_data_path}.csv'
        write_series_to_csv(series_list, filename)


if __name__ == '__main__':
    main()

