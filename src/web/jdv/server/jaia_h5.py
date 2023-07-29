from typing import List, Union, AbstractSet, Dict
from pathlib import Path
from objects import jaialog_get_object_list

import h5py
import logging
import os
import re

class JaiaH5FileSet:
    h5Filenames: List[str]
    h5Files: List[h5py.File] = None

    def __init__(self, filenames: List[Union[str, Path]], shouldConvertGoby=False) -> None:
        self.h5Filenames = filenames
        self._getH5Files(shouldConvertGoby)

    def duration(self):
        '''Returns duration in seconds'''
        UTIME_PATH = 'goby::health::report/goby.middleware.protobuf.VehicleHealth/_utime_'

        h5File = self.h5Files[0]

        # Get duration of the first log, if the h5 file exists
        try:
            start = h5File[UTIME_PATH][0]
            end = h5File[UTIME_PATH][-1]
            return int(end - start)
        except (OSError, KeyError) as e:
            logging.debug(e)
            return None

    def _getH5Files(self, shouldConvertGoby: bool):
        h5Files: List[h5py.File] = []

        for h5FileName in self.h5Filenames:
            h5Path = Path(h5FileName)

            # h5 file doesn't exist
            if not h5Path.is_file():

                # Not supposed to convert goby files, so exception
                if not shouldConvertGoby:
                    e = FileNotFoundError()
                    e.filename = h5Path
                    raise e

                # Otherwise convert
                gobyPath = h5Path.with_suffix('.goby')
                if gobyPath.is_file():
                    # convert goby file to h5 file
                    cmd = f'nice -n 10 goby_log_tool --input_file {gobyPath} --output_file {h5Path} --format HDF5'
                    logging.info(cmd)
                    os.system(cmd)
                else:
                    # Can't find goby file, so exception
                    logging.error(f'Cannot find "{h5Path}" or "{gobyPath}"')
                    e = FileNotFoundError()
                    e.filename = h5Path
                    e.filename2 = gobyPath
                    raise e

            # Add the generated or existing h5 file
            h5Files.append(h5py.File(h5FileName))

        self.h5Files = h5Files

    def fields(self, root_path: str = None):
        '''Returns a list of the available data fields below a root_path'''
        fields: AbstractSet[str] = set()

        if root_path is None or root_path == '' or root_path == '/':
            root_path = '/'
        else:
            # h5py doesn't like initial slashes, unless it's the root path
            root_path = root_path.lstrip('/')

        print(root_path)

        for h5_file in self.h5Files:
            try:
                fields = fields.union(h5_file[root_path].keys())
            except AttributeError:
                # If this path is a dataset, it has no "keys()"
                pass
        
        series = list(fields)
        series.sort()

        return series

    def commands(self):
        # A dictionary mapping bot_id to an array of mission dictionaries
        results: Dict[str, Dict] = {}

        for log_file in self.h5Files:
            # Search for Command items
            for path in log_file.keys():

                HUB_COMMAND_RE = re.compile(r'jaiabot::hub_command.*;([0-9]+)')
                m = HUB_COMMAND_RE.match(path)
                if m is not None:
                    bot_id = m.group(1)
                    hub_command_path = path

                    if bot_id not in results:
                        results[bot_id] = []
                    
                    command_path = hub_command_path + '/jaiabot.protobuf.Command'
                    commands = jaialog_get_object_list(log_file[command_path], repeated_members={"goal"})

                    results[bot_id] = commands

        return results


# Testing
if __name__ == '__main__':
    fileSet = JaiaH5FileSet(['/var/log/jaiabot/bot_offload/hub_fleet0_22350321T011042.h5'])
    print(fileSet.duration())
    print(fileSet.commands())
