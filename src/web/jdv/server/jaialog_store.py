import glob
from typing import Iterable
import h5py
import logging
import json
import re
import datetime
import os

import kmz

from objects import *
from moos_messages import *
from pprint import pprint
from pathlib import Path
from jaia_h5 import JaiaH5FileSet
from typing import *

import log_conversion


# JAIA message types as python dataclasses
from jaia_messages import *


def h5_get_string(dataset):
    s = ''.join([chr(a) for a in list(list(dataset)[0])])
    return s


def h5_get_hovertext(dataset):
    '''Get the hovertext for an h5 dataset'''

    # Get the enum value names
    try:
        enum_names = dataset.attrs['enum_names']
        enum_values = dataset.attrs['enum_values']
        enum_dict = { int(enum_values[index]): enum_names[index] for index in range(0, len(enum_values))}
        return enum_dict

    except KeyError:
        return None


def itemsmatching(file: h5py.File, regular_expression: re.Pattern):
    '''Returns an iterator for the paths matching regular_expression found in HDF5 file'''
    matching_items = []

    def func(name, object):
        m = regular_expression.match(name)

        if m is not None:
            matching_items.append(name)

    file.visititems(func)

    for item in matching_items:
        yield item


# Path descriptions

try:
    path_descriptions = json.load(open('jaiabot_paths.json'))
except FileNotFoundError:
    path_descriptions = {}


def jaia_get_description(path):
    for description in path_descriptions:
        if 'path' in description:
            if description['path'] == path:
                return description
        
        if 'path_regex' in description:
            if re.match(description['path_regex'], path):
                return description
    
    return None

def get_title_from_path(path):
    components = path.split('/')
    if len(components) < 2:
        logging.warning(f'Not enough components in path: {path}')
        return ''

    components = components[1:]

    message_type_components = components[0].split('.')

    if len(message_type_components) < 1:
        logging.warning(f'Invalid path: {path}')
        return ''

    components[0] = components[0].split('.')[-1]
    return '/'.join(components)


# Path regular expressions

BOT_STATUS_RE = re.compile(r'^jaiabot::bot_status.*;([0-9]+)/jaiabot.protobuf.BotStatus$')
HUB_COMMAND_RE = re.compile(r'jaiabot::hub_command.*;([0-9]+)')
TASK_PACKET_RE = re.compile(r'jaiabot::task_packet.*;([0-9]+)')

# Data fetch functions

UTIME_PATH = 'goby::health::report/goby.middleware.protobuf.VehicleHealth/_utime_'




class JaialogStore:
    LOG_DIR: str
    log_conversion_manager: log_conversion.LogConversionManager = None

    def __init__(self, log_dir: Union[str, Path]='/var/log/jaiabot/bot_offload/') -> None:

        if isinstance(log_dir, Path):
            log_dir = log_dir.expanduser()
        elif isinstance(log_dir, str):
            log_dir = os.path.expanduser(log_dir)

        self.LOG_DIR = str(log_dir)
        logging.info(f'Log directory: {log_dir}')
        os.makedirs(log_dir, exist_ok=True)

        self.log_conversion_manager = log_conversion.LogConversionManager(log_dir)


    def getLogs(self):
        '''Get list of available logs'''
        results: list[dict] = []

        if not os.path.isdir(self.LOG_DIR):
            logging.error(f'Directory does not exist: {self.LOG_DIR}')
            return results

        log_file_dict: dict[str, dict] = {}

        for file_path_string in glob.glob(self.LOG_DIR + '/*_*_????????T??????.*'):
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


    def fullPathForLog(self, logName: str):
        return f'{self.LOG_DIR}/{logName}.h5'


    def openLog(self, logName: str):
        return h5py.File(self.fullPathForLog(logName))
    

    def openLogs(self, logNames: List[str]):
        return [self.openLog(logName) for logName in logNames]


    def convertIfNeeded(self, log_names: List[str]):
        '''Converts a llist of logs if needed, returning True if they're already converted, False otherwise'''
        done = True

        for log_name in log_names:
            h5_path = Path(f'{self.LOG_DIR}/{log_name}.h5')

            if not h5_path.exists():
                self.log_conversion_manager.addLogName(log_name)
                done = False
            
        return {
            'done': done
        }


    def getFields(self, log_names: List[str], root_path='/'):
        '''Get a list of the fields below a root path in a set of logs'''
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.fields(root_path=root_path)


    def getSeries(self, log_names: List[str], paths: List[str]):
        '''Get a series'''

        if log_names is None or paths is None:
            return []

        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

        return h5_files.getSeries(paths)


    def getMap(self, log_names: List[str]):
        # Open all our logs
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.map()


    def getTaskPacketDicts(self, log_filenames: List[str], scheme=1):

        # Open all our logs
        log_files = self.openLogs(log_filenames)

        results = []

        for log_file in log_files:
            
            # Search for Command items
            for path in log_file.keys():

                m = TASK_PACKET_RE.match(path)
                if m is not None:
                    task_packet_group_path = path

                    task_packet_path = task_packet_group_path + '/jaiabot.protobuf.TaskPacket'
                    task_packets = jaialog_get_object_list(log_file[task_packet_path], repeated_members={"measurement"})

                    results += task_packets

        if scheme is not None:
            results = list(filter(lambda object: object['_scheme_']==scheme, results))

        return results


    def getCommands(self, log_filenames: List[str]):
        h5_paths = [f'{self.LOG_DIR}/{fn}.h5' for fn in log_filenames]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

        return h5_files.commands()


    def getActiveGoals(self, log_filenames: List[str]):
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_filenames]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.activeGoals()


    def getTaskPacketsJSON(self, log_filenames: List[str]):
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_filenames]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.taskPackets()


    def getTaskPackets(self, log_filenames: List[str], scheme=1) -> Iterable[TaskPacket]:
        return [TaskPacket.from_dict(task_packet_json) for task_packet_json in self.getTaskPacketDicts(log_filenames, scheme)]


    def generateKMZ(self, h5_filename: str, kmz_filename: str):
        task_packets = self.getTaskPackets([h5_filename])
        kmz.write_file(task_packets, kmz_filename)


    def getH5File(self, logName: str):
        '''Returns a Jaia H5 file object'''
        return open(self.fullPathForLog(logName), 'br')


    def deleteLog(self, logName: str):
        print(f'Deleting {self.LOG_DIR}/{logName}.*')
        for path in glob.glob(f'{self.LOG_DIR}/{logName}.*'):
            logging.warning(f'Deleting {path}')
            os.remove(path)


# Testing
if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)

    jaialogStore = JaialogStore('~/jaia_logs_test')
    pprint(jaialogStore.getTaskPackets(['bot4_fleet1_20230712T182625']))
