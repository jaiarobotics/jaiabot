from typing import List, Union
from pathlib import Path

import h5py
import logging

class JaiaH5FileSet:
    h5Filenames: List[str]
    h5Files: List[h5py.File]

    def __init__(self, filenames: List[Union[str, Path]]) -> None:
        self.h5Filenames = filenames
        self.h5Files = [h5py.File(fn) for fn in filenames]

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
