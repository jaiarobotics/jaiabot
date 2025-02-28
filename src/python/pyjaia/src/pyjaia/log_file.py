import h5py
from typing import *
import re
from pyjaia.series import *


class LogFile:
    file: h5py.File

    def __init__(self, file: str):
        self.file = h5py.File(file)


    def get_paths_matching(self, regex_string: str):
        matches: List[str] = []
        data_path_re = re.compile(regex_string)

        def add_if_match(name: str, obj: Any):
            if not isinstance(obj, h5py.Dataset):
                return

            if data_path_re.search(name) is None:
                return

            matches.append(name)

        self.file.visititems(add_if_match)

        return matches


    def get_series(self, data_path: str):
        return Series.loadFromH5File(self.file, data_path)
    

    def get_series_matching(self, regex_string: str):
        results: List[Series] = []
        for data_path in self.get_paths_matching(regex_string):
            try:
                results.append(self.get_series(data_path))
            except ValueError:
                pass
        return results
