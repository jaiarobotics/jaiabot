from typing import *
from threading import *
from time import *
from pathlib import *
from os import *

import logging

logging.basicConfig(level=logging.INFO)


class LogConversionManager:
    '''This class runs on a thread, and converts the logs given to it'''

    logRootPath: str
    logNamesQueue: List[str] = []

    thread: Thread
    isConverting: bool = False


    def __init__(self, logRootPath: str) -> None:
        self.logRootPath = logRootPath


    def addLogName(self, logName: str):
        if logName not in self.logNamesQueue:
            self.logNamesQueue.append(logName)

        if not self.isConverting:
            self.startConverting()


    def startConverting(self):
        def workFunc():
            self.isConverting = True

            while len(self.logNamesQueue) > 0:
                logName = self.logNamesQueue.pop(0)
                goby_path = Path(self.logRootPath, logName + '.goby')
                h5_path   = Path(self.logRootPath, logName + '.h5')

                if h5_path.is_file():
                    logging.info(f'File already exists: {h5_path}')
                    continue

                if not goby_path.is_file():
                    logging.error(f'File not found: {goby_path}')
                    continue

                cmd = f'goby_log_tool --input_file {goby_path} --output_file {h5_path} --format HDF5'
                logging.info(cmd)
                system(cmd)

            logging.info('Done!')
            self.isConverting = False

        self.thread = Thread(target=workFunc, daemon=True)
        self.thread.start()
