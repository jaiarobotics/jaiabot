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
from typing import *

import log_conversion


# JAIA message types as python dataclasses
from jaia_messages import *


LOG_DIR='logs'
log_conversion_manager: log_conversion.LogConversionManager = None

# Utility functions

def set_directory(directory):
    global LOG_DIR, log_conversion_manager
    LOG_DIR = str(directory)
    logging.info(f'Log directory: {directory}')
    os.makedirs(directory, exist_ok=True)
    log_conversion_manager = log_conversion.LogConversionManager(LOG_DIR)

# Data fetch functions

UTIME_PATH = 'goby::health::report/goby.middleware.protobuf.VehicleHealth/_utime_'

def get_logs():
    '''Get list of available logs'''
    results: list[dict] = []
    logging.warning('log_dir = ' + LOG_DIR)

    if not os.path.isdir(LOG_DIR):
        logging.error(f'Directory does not exist: {LOG_DIR}')
        return results

    log_file_dict: dict[str, dict] = {}

    for file_path_string in glob.glob(LOG_DIR + '/*_*_????????T??????.*'):
        file_path = Path(file_path_string)
        filename = file_path.stem
        log_file_info = log_file_dict.setdefault(filename, {})

        suffix = file_path.suffix
        components = re.match(r'(.+)_(.+)_(.+)$', filename)
        bot, fleet, date_string = components.groups()

        log_file_info.update({
            'bot': bot,
            'fleet': fleet,
            'filename': filename
        })

        try:
            date = datetime.datetime.strptime(date_string, r'%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)
            log_file_info['timestamp'] = date.timestamp()
        except ValueError:
            logging.warning(f'No date in filename {filename}')
            continue

        if suffix == '.goby':
            log_file_info['size'] = file_path.stat().st_size

        if suffix == '.h5':
            try:
                h5_file = JaiaH5FileSet([file_path])
                duration = h5_file.duration()
            except FileNotFoundError:
                duration = None

            log_file_info['duration'] = duration

    return list(log_file_dict.values())


def convert_if_needed(log_names: List[str]):
    '''Converts a llist of logs if needed, returning True if they're already converted, False otherwise'''
    done = True

    for log_name in log_names:
        h5_path = Path(f'{LOG_DIR}/{log_name}.h5')

        if not h5_path.exists():
            log_conversion_manager.addLogName(log_name)
            done = False
        
    return {
        'done': done
    }


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
