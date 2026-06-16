import subprocess
import glob
from typing import Iterable
import zipfile
import h5py
import logging
import re
import datetime
import os
from threading import Thread

from pyjaia import kmz
from pprint import pprint
from pathlib import Path
from typing import *

from dataclasses import dataclass, field
from dataclasses_json import dataclass_json


# JAIA packages
from .jaia_messages import *
from .objects import *
from .jaia_h5 import JaiaH5FileSet
from .moos_messages import *
import pyjaia.jaialog_store.log_conversion as log_conversion


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


@dataclass
@dataclass_json
class LogDescription:
    '''Metadata pertaining to a log'''

    bot: str = ''
    fleet: str = ''
    
    filename: str = ''
    '''File stem for this log (without path, .goby or .h5 extension)'''

    timestamp: float = 0
    '''UNIX timestamp of the date (from the filename)'''

    duration: Optional[float] = None
    '''Log duration (in microseconds).  Only present for a log that has been converted to HDF5 format.'''

    size: Optional[int] = None
    '''Log file size (in bytes)'''


@dataclass
@dataclass_json
class LogDirectory:
    '''A list of available logs with their metadata, and the available space on the storage device'''

    availableSpace: int = 0
    '''Available storage space (in bytes)'''

    logs: List[LogDescription] = field(default_factory=list)
    '''List of available logs'''


@dataclass
class FileDownload:
    '''A file to be downloaded by the client'''

    filename: str = ''
    '''Filename for the downloaded file'''

    content: bytes = b''
    '''Content of the file'''

    mimetype: str = ''
    '''MIME type of the file'''


class H5ZipManager:
    '''Runs on a thread, zipping a set of H5 logs together and reporting progress'''

    log_dir: str
    '''Directory containing the source .h5 files'''

    temp_dir: str
    '''Directory in which to build the zip file (local disk, to avoid round-tripping through s3fs)'''

    log_names: List[str]
    thread: Optional[Thread] = None
    status: dict


    def __init__(self, log_dir: str, temp_dir: str) -> None:
        self.log_dir = log_dir
        self.temp_dir = temp_dir
        self.log_names = []
        self.status = {'completed': 0, 'total': 0, 'done': False, 'error': None}


    def start(self, log_names: List[str]):
        if self.thread is not None and self.thread.is_alive():
            return

        self.log_names = log_names
        self.status = {'completed': 0, 'total': len(log_names), 'done': False, 'error': None}

        def workFunc():
            zip_filename = f'{self.temp_dir}/h5_files.zip'

            try:
                with zipfile.ZipFile(zip_filename, 'w') as zip_file:
                    for log_name in self.log_names:
                        zip_file.write(f'{self.log_dir}/{log_name}.h5', arcname=f'{log_name}.h5')
                        self.status['completed'] += 1
            except Exception as e:
                logging.error(f'Error zipping H5 files: {e}')
                self.status['error'] = str(e)

            self.status['done'] = True

        self.thread = Thread(target=workFunc, daemon=True)
        self.thread.start()


    def getStatus(self):
        return self.status


    def getFilePath(self) -> str:
        '''Returns the path to the completed zip file.  The caller is responsible for removing it.'''
        return f'{self.temp_dir}/h5_files.zip'


class JaialogStore:
    LOG_DIR: str
    TEMP_DIR: str
    log_conversion_manager: log_conversion.LogConversionManager = None

    def __init__(self, log_dir: Union[str, Path]='/var/log/jaiabot/bot_offload/') -> None:

        if isinstance(log_dir, Path):
            log_dir = log_dir.expanduser()
        elif isinstance(log_dir, str):
            log_dir = os.path.expanduser(log_dir)

        self.LOG_DIR = str(log_dir)
        os.makedirs(log_dir, exist_ok=True)

        # Local disk directory (parent of LOG_DIR), used for scratch files so we don't
        # round-trip large temporary files (e.g. zip downloads) through the s3fs mount
        self.TEMP_DIR = str(Path(self.LOG_DIR).parent)

        self.log_conversion_manager = log_conversion.LogConversionManager(log_dir)
        self.h5_zip_manager = H5ZipManager(self.LOG_DIR, self.TEMP_DIR)


    def getLogs(self):
        '''Get list of available logs'''
        statvfs = os.statvfs(self.LOG_DIR)

        results = LogDirectory()
        results.availableSpace = statvfs.f_bfree * statvfs.f_frsize

        if not os.path.isdir(self.LOG_DIR):
            logging.error(f'Directory does not exist: {self.LOG_DIR}')
            return results

        log_file_dict: dict[str, LogDescription] = {}
        '''maps the log names onto their description, so we don't duplicate'''

        goby_and_h5_path_strings = glob.glob(self.LOG_DIR + '/bot*_fleet*_????????T??????.goby') + \
            glob.glob(self.LOG_DIR + '/bot*_fleet*_????????T??????.h5')

        for file_path_string in goby_and_h5_path_strings:
            file_path = Path(file_path_string)
            filename = file_path.stem

            try:
                file_description = log_file_dict[filename]
            except KeyError:
                file_description = LogDescription()
                log_file_dict[filename] = file_description

            suffix = file_path.suffix
            components = re.match(r'(.+)_(.+)_(.+)$', filename)
            file_description.bot, file_description.fleet, date_string = components.groups()
            file_description.filename = filename

            try:
                date = datetime.datetime.strptime(date_string, r'%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)
                file_description.timestamp = date.timestamp()
            except ValueError:
                logging.warning(f'No date in filename {filename}')
                continue

        results.logs = list(log_file_dict.values())

        return results


    def getLogMetadata(self, log_names: List[str]):
        '''Computes size and duration for the given logs, for lazily filling in the log list in the UI'''
        results: dict[str, dict] = {}

        for log_name in log_names:
            size: Optional[int] = None
            duration: Optional[float] = None

            for suffix in ('.goby', '.h5'):
                file_path = Path(self.LOG_DIR, log_name + suffix)
                if not file_path.is_file():
                    continue

                size = (size or 0) + file_path.stat().st_size

                if suffix == '.h5':
                    try:
                        duration = JaiaH5FileSet([file_path]).duration()
                    except FileNotFoundError:
                        duration = None

            results[log_name] = {'size': size, 'duration': duration}

        return results


    def fullPathForLog(self, logName: str):
        return f'{self.LOG_DIR}/{logName}.h5'


    def openLog(self, logName: str):
        return h5py.File(self.fullPathForLog(logName))
    

    def openLogs(self, logNames: List[str]):
        logs: List[h5py.File] = []
        for logName in logNames:
            try:
                logs.append(self.openLog(logName))
            except OSError:
                # Corrupt hdf5 file?
                continue
        
        return logs


    def convertIfNeeded(self, log_names: List[str]):
        '''Converts a list of logs if needed, returning the number already converted and the total'''
        completed = 0

        for log_name in log_names:
            h5_path = Path(f'{self.LOG_DIR}/{log_name}.h5')

            if h5_path.exists():
                completed += 1
            else:
                self.log_conversion_manager.addLogName(log_name)

        return {
            'done': completed == len(log_names),
            'completed': completed,
            'total': len(log_names)
        }


    def getFields(self, log_names: List[str], root_path=None):
        '''Get a list of the fields below a root path in a set of logs'''
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.fields(root_path=root_path)


    def getAllSeriesDescriptors(self, log_names: List[str]):
        '''Get a list of all series descriptors in a set of logs'''
        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)
        return h5_files.getAllSeriesDescriptors()


    def getSeries(self, log_names: List[str], paths: List[str]):
        """Gets a list of series path datasets from a list of log names.

        Args:
            log_names (List[str]): List of log names.
            paths (List[str]): List of paths to the datasets to load.

        Returns:
            List[Dict]: List of series dictionaries representing the series that were loaded.
        """

        if log_names is None or paths is None:
            return []

        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

        return h5_files.getSeries(paths)


    def getObjects(self, log_names: List[str], path: str):
        """Gets a list of objects from a list of log names.

        Args:
            log_names (List[str]): List of log names.
            path (str): Path to the dataset to load.
        """
        
        if log_names is None or path is None:
            return []

        h5_paths = [f'{self.LOG_DIR}/{name}.h5' for name in log_names]
        h5_files = JaiaH5FileSet(h5_paths, shouldConvertGoby=True)

        return h5_files.getObjects(path)


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

                    # Delete any fields that are actually not present
                    for task_packet in task_packets:
                        task_packet_type = task_packet.get('type', None)
                        if task_packet_type != 'DIVE':
                            del(task_packet['dive'])
                        
                        if task_packet_type not in ['DIVE', 'SURFACE_DRIFT']:
                            del(task_packet['drift'])

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


    def _availableSpace(self, path: str) -> int:
        '''Returns the available space (in bytes) on the device containing path'''
        statvfs = os.statvfs(path)
        return statvfs.f_bfree * statvfs.f_frsize


    def getH5Files(self, logNames: list[str]) -> FileDownload:
        '''Returns an H5 file, zipped if multiple logs are requested'''

        # If there's only one log, return the h5 file directly.  If there are multiple logs, zip them up and return the zip file.
        if len(logNames) == 1:
            with open(self.fullPathForLog(logNames[0]), 'br') as f:
                content = f.read()

            return FileDownload(filename=f'{logNames[0]}.h5', content=content, mimetype='application/x-hdf')

        else:
            h5_paths = [Path(self.fullPathForLog(logName)) for logName in logNames]
            total_size = sum(h5_path.stat().st_size for h5_path in h5_paths)

            availableSpace = self._availableSpace(self.TEMP_DIR)

            if total_size > availableSpace:
                raise Exception(f'Not enough space to zip {len(logNames)} log(s) '
                                 f'({total_size} bytes needed, {availableSpace} bytes available)')

            zip_filename = f'{self.TEMP_DIR}/h5_files.zip'
            with zipfile.ZipFile(zip_filename, 'w') as zip_file:
                for logName, h5_path in zip(logNames, h5_paths):
                    zip_file.write(h5_path, arcname=f'{logName}.h5')

            with open(zip_filename, 'br') as f:
                content = f.read()

            os.remove(zip_filename)

            return FileDownload(filename='h5_files.zip', content=content, mimetype='application/zip')


    def startH5Zip(self, logNames: list[str]):
        '''Starts (or returns the status of) a background job to zip H5 files for the given logs'''
        h5_paths = [Path(self.fullPathForLog(logName)) for logName in logNames]
        total_size = sum(h5_path.stat().st_size for h5_path in h5_paths)

        availableSpace = self._availableSpace(self.TEMP_DIR)

        if total_size > availableSpace:
            raise Exception(f'Not enough space to zip {len(logNames)} log(s) '
                             f'({total_size} bytes needed, {availableSpace} bytes available)')

        self.h5_zip_manager.start(logNames)
        return self.h5_zip_manager.getStatus()


    def getH5ZipStatus(self):
        '''Returns the status of the background H5 zip job'''
        return self.h5_zip_manager.getStatus()


    def getH5ZipFilePath(self) -> str:
        '''Validates and returns the path to the completed H5 zip file.  The caller is responsible for removing it.'''
        status = self.h5_zip_manager.getStatus()

        if status['error'] is not None:
            raise Exception(status['error'])

        if not status['done']:
            raise Exception('Zip file is not ready yet')

        return self.h5_zip_manager.getFilePath()


    def getUBXFile(self, logNames: list[str]) -> FileDownload:
        '''Returns a UBX file object, zipped if multiple logs are requested'''

        # Convert h5 to ubx if needed
        for logName in logNames:
            subprocess.run(['jaia-ubx-extractor', f'{self.LOG_DIR}/{logName}.h5'], check=True)
            Path(f'{self.LOG_DIR}/{logName}.ubx').touch() # If there's no ubx data, make sure there's a file there

        # If there's only one log, return the ubx file directly.  If there are multiple logs, zip them up and return the zip file.
        if len(logNames) == 1:
            with open(f'{self.LOG_DIR}/{logNames[0]}.ubx', 'br') as f:
                content = f.read()

            return FileDownload(filename=f'{logNames[0]}.ubx', content=content, mimetype='application/octet-stream')
        
        else:
            zip_filename = f'{self.LOG_DIR}/ubx_files.zip'
            with zipfile.ZipFile(zip_filename, 'w') as zip_file:
                for logName in logNames:
                    zip_file.write(f'{self.LOG_DIR}/{logName}.ubx', arcname=f'{logName}.ubx')

            with open(zip_filename, 'br') as f:
                content = f.read()

            os.remove(zip_filename)

            return FileDownload(filename='ubx_files.zip', content=content, mimetype='application/zip')


    def deleteLog(self, logName: str):
        print(f'Deleting {self.LOG_DIR}/{logName}.*')
        for path in glob.glob(f'{self.LOG_DIR}/{logName}.*'):
            logging.warning(f'Deleting {path}')
            os.remove(path)


# Testing
if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)

    task_packets = JaialogStore().getTaskPacketDicts(['bot4_fleet14_20240320T154212'])

    pprint(task_packets)
