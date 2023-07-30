from cmath import isnan
from dataclasses import dataclass, field
from email.policy import default
import glob
from typing import Iterable, Type, Optional
import h5py
import logging
import json
import re
import math
import copy
import datetime
import os

import bisect
import kmz

from objects import *
from moos_messages import *
from pprint import pprint
from pathlib import Path
from jaia_h5 import JaiaH5FileSet
from series import Series, h5_get_series


# JAIA message types as python dataclasses
from jaia_messages import *


LOG_DIR='logs'

# Utility functions

def set_directory(directory):
    global LOG_DIR
    LOG_DIR = str(directory)
    logging.info(f'Log directory: {directory}')
    os.makedirs(directory, exist_ok=True)

# Data fetch functions

UTIME_PATH = 'goby::health::report/goby.middleware.protobuf.VehicleHealth/_utime_'

def get_logs():
    '''Get list of available logs'''
    results = []
    logging.warning('log_dir = ' + LOG_DIR)
    for goby_file_path_string in glob.glob(LOG_DIR + '/*_*_????????T??????.goby'):
        goby_path = Path(goby_file_path_string)
        filename = goby_path.stem
        components = re.match(r'(.+)_(.+)_(.+)$', filename)
        bot, fleet, date_string = components.groups()

        try:
            date = datetime.datetime.strptime(date_string, r'%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            logging.warning(f'No date in filename {filename}')
            continue

        file_size = goby_path.stat().st_size

        h5_path = goby_path.with_suffix('.h5')

        try:
            h5_file = JaiaH5FileSet([h5_path])
            duration = h5_file.duration()
        except FileNotFoundError:
            duration = None

        results.append({
            'bot': bot,
            'fleet': fleet,
            'timestamp': date.timestamp(),
            'size': file_size,
            'duration': duration,
            'filename': filename
        })

    return results


def get_fields(log_names: List[str], root_path='/'):
    '''Get a list of the fields below a root path in a set of logs'''
    h5_paths = [f'{LOG_DIR}/{name}.h5' for name in log_names]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
    return h5_files.fields(root_path=root_path)


def get_series(log_names: List[str], paths: List[str]):
    '''Get a series'''

    if log_names is None or paths is None:
        return []

    h5_paths = [f'{LOG_DIR}/{name}.h5' for name in log_names]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

    return h5_files.getSeries(paths)


def get_map(log_names: List[str]):
    # Open all our logs
    h5_paths = [f'{LOG_DIR}/{name}.h5' for name in log_names]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
    return h5_files.map()


def get_commands(log_filenames: List[str]):
    h5_paths = [f'{LOG_DIR}/{fn}.h5' for fn in log_filenames]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

    return h5_files.commands()


def get_active_goals(log_filenames: List[str]):
    h5_paths = [f'{LOG_DIR}/{name}.h5' for name in log_filenames]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
    return h5_files.activeGoals()


def get_task_packets_json(log_filenames: List[str]):
    h5_paths = [f'{LOG_DIR}/{name}.h5' for name in log_filenames]
    h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
    return h5_files.taskPackets()


def get_task_packets(log_filenames) -> Iterable[TaskPacket]:
    return [TaskPacket.from_dict(task_packet_json) for task_packet_json in get_task_packets_json(log_filenames)]


def generate_kmz(h5_filename: str, kmz_filename: str):
    task_packets = get_task_packets([h5_filename])
    kmz.write_file(task_packets, kmz_filename)


# Testing
if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    set_directory(Path('~/jaia_logs_test').expanduser())
    pprint(get_task_packets(['bot4_fleet1_20230712T182625']))
