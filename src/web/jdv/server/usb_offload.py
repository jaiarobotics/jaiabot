import glob
import json
import logging
import subprocess

from dataclasses import dataclass
from dataclasses_json import dataclass_json
from threading import *
from typing import *


MOUNT_POINT = '/media/jaia-usb'
'''Directory where the hub mounts the operator's USB drive'''

DESTINATION_SUBDIR = 'jaia-logs'
'''Directory created on the USB drive to hold the copied logs'''


@dataclass_json
@dataclass
class UsbOffloadStatus:
    '''Progress of the current (or most recent) copy of logs to a USB drive'''

    isCopying: bool = False
    '''True while a copy is in progress'''

    logsRemaining: int = 0
    '''Number of logs still to be copied'''

    logsTotal: int = 0
    '''Number of logs in the current copy'''

    error: Optional[str] = None
    '''Description of the failure that ended the last copy, if there was one'''


def findUsbPartition():
    '''Returns the device path of the USB partition plugged into the hub, raising unless there is exactly one'''
    output = subprocess.check_output(['lsblk', '-J', '-o', 'PATH,TRAN,FSTYPE,TYPE,MOUNTPOINT'])

    # Select on the parent disk's transport, since an SD card's partitions are hotplug but not USB
    partitions = [partition
                  for disk in json.loads(output)['blockdevices'] if disk['tran'] == 'usb'
                  for partition in disk.get('children', [])
                  if partition['fstype'] is not None]

    if len(partitions) == 0:
        raise RuntimeError("No USB drive found.  Please plug a drive into one of the hub's USB ports.")

    if len(partitions) > 1:
        raise RuntimeError(f'{len(partitions)} USB drives found.  Please plug in only one drive.')

    return partitions[0]['path']


def sudo(*args: str):
    '''Runs a command as root, raising a RuntimeError containing its stderr if it fails'''
    try:
        subprocess.run(['sudo', *args], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(e.stderr.decode().strip())


class UsbOffloadManager:
    '''This class runs on a thread, and copies the logs given to it onto a USB drive'''

    logRootPath: str
    logNamesQueue: List[str]
    status: UsbOffloadStatus

    thread: Thread


    def __init__(self, logRootPath: str) -> None:
        self.logRootPath = logRootPath
        self.logNamesQueue = []
        self.status = UsbOffloadStatus()


    def addLogNames(self, logNames: List[str]):
        '''Starts copying the named logs to a USB drive, unless a copy is already in progress'''
        if not self.status.isCopying:
            self.logNamesQueue = list(logNames)
            self.status = UsbOffloadStatus(isCopying=True,
                                           logsRemaining=len(logNames),
                                           logsTotal=len(logNames))
            self.startCopying()

        return self.status


    def getStatus(self):
        return self.status


    def startCopying(self):
        def workFunc():
            destination = f'{MOUNT_POINT}/{DESTINATION_SUBDIR}'

            try:
                # A previous copy may have been interrupted by a service restart, leaving the drive mounted
                subprocess.run(['sudo', 'umount', MOUNT_POINT], capture_output=True)

                sudo('mkdir', '-p', MOUNT_POINT)
                sudo('mount', findUsbPartition(), MOUNT_POINT)
                sudo('mkdir', '-p', destination)

                while len(self.logNamesQueue) > 0:
                    logName = self.logNamesQueue.pop(0)
                    paths = glob.glob(f'{self.logRootPath}/{logName}.*')

                    if len(paths) == 0:
                        logging.warning(f'No files found for log: {logName}')
                    else:
                        # Copying without -p, since preserving ownership fails on the FAT filesystems most drives use
                        sudo('cp', *paths, destination)

                    self.status.logsRemaining = len(self.logNamesQueue)

                logging.info(f'Copied {self.status.logsTotal} logs to {destination}')

            except Exception as e:
                logging.error(e)
                self.status.error = str(e)

            finally:
                subprocess.run(['sudo', 'umount', MOUNT_POINT], capture_output=True)
                self.status.isCopying = False

        self.thread = Thread(target=workFunc, daemon=True)
        self.thread.start()
