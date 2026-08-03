import glob
import json
import logging
import os
import re
import subprocess

from dataclasses import dataclass
from dataclasses_json import dataclass_json
from threading import *
from typing import *


MOUNT_POINT = '/media/jaia-usb'
'''Directory where the hub mounts the operator's USB drive'''

DESTINATION_SUBDIR = 'jaia-logs'
'''Directory created on the USB drive to hold the copied logs'''

RESERVED_LABELS = ['rootfs', 'boot', 'data', 'updates', 'overlay']
'''Filesystem labels of the hub's own media, which is never the drive the operator plugged in'''

PROGRESS_RE = re.compile(r'(\d+)%')
'''Matches the percentage rsync --info=progress2 rewrites onto its output line'''


@dataclass_json
@dataclass
class UsbOffloadStatus:
    '''Progress of the current (or most recent) copy of logs to a USB drive'''

    isCopying: bool = False
    '''True while a copy is in progress'''

    logsCopied: int = 0
    '''Number of logs written to the drive so far'''

    logsTotal: int = 0
    '''Number of logs in this copy, which grows when more are added while it runs'''

    percentComplete: int = 0
    '''Percentage of this copy's total bytes written to the drive so far'''

    errorMessage: Optional[str] = None
    '''Description of the failure that ended the last copy, if there was one.'''

    isDriveAvailable: bool = False
    '''True while there is a drive plugged in for the operator to copy to'''


def findUsbPartition():
    '''Returns the device path of the USB partition plugged into the hub, raising unless there is exactly one'''
    output = subprocess.check_output(
        ['lsblk', '-J', '-l', '-o', 'NAME,PATH,PKNAME,TRAN,FSTYPE,LABEL,TYPE,MOUNTPOINT'])
    devices = json.loads(output)['blockdevices']

    # Ask for a flat list and pair each partition with its disk by PKNAME.  lsblk only nests
    # partitions under their disk when the NAME column is requested, which is too subtle to rely on.
    # Select on the disk's transport, since an SD card's partitions are hotplug but not USB.
    usbDiskNames = {device['name'] for device in devices
                    if device['type'] == 'disk' and device['tran'] == 'usb'}

    # The fleet config card is attached over USB too, so skip media the hub has mounted or labelled
    # for its own use: fstab mounts the config card at boot, but our ansible tasks leave it unmounted.
    partitions = [device for device in devices
                  if device['type'] == 'part'
                  and device['pkname'] in usbDiskNames
                  and device['fstype'] is not None
                  and device['mountpoint'] is None
                  and device['label'] not in RESERVED_LABELS]

    if len(partitions) == 0:
        raise RuntimeError("No USB drive found.  Please plug a drive into one of the hub's USB ports.")

    if len(partitions) > 1:
        raise RuntimeError(f'{len(partitions)} USB drives found.  Please plug in only one drive.')

    return partitions[0]['path']


def hasUsbDrive():
    '''Returns whether there is exactly one USB drive plugged in that we could copy logs to'''
    try:
        findUsbPartition()
        return True
    except Exception:
        return False


def sudo(*args: str):
    '''Runs a command as root, raising a RuntimeError containing its stderr if it fails'''
    try:
        subprocess.run(['sudo', *args], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(e.stderr.decode().strip())


def rsyncWithProgress(paths: List[str], destination: str, onProgress: Callable[[float], None]):
    '''Copies files to the destination, calling onProgress with the fraction of them written so far.

       rsync rather than cp, so that filling the drive leaves no truncated file that looks like a
       whole log.  No -a, since preserving ownership fails on the FAT filesystems most drives use.'''
    process = subprocess.Popen(['sudo', 'rsync', '--info=progress2', *paths, destination],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    # progress2 rewrites one line, ending each update with a carriage return rather than a newline.
    # text=True puts stdout in universal newlines mode, so readline() returns on those too.
    for line in process.stdout:
        match = PROGRESS_RE.search(line)
        if match is not None:
            onProgress(int(match.group(1)) / 100)

    if process.wait() != 0:
        raise RuntimeError(process.stderr.read().strip())


class UsbOffloadManager:
    '''Copies logs to a USB drive on a background thread, one log at a time.

       Logs added while a copy is running join that copy rather than being turned away, so the
       operator can keep browsing, selecting and queueing logs without waiting for it to finish.'''

    logRootPath: str
    logNamesQueue: List[str]
    status: UsbOffloadStatus

    logNamesAccepted: List[str]
    '''Every log taken into this copy, so that asking for one twice does not copy it twice'''

    bytesTotal: int
    '''Size of every log in this copy, which grows when more are added while it runs'''

    bytesCopied: int
    '''Size of the logs written to the drive so far'''

    bytesInFlight: float
    '''How much of the log currently being copied rsync has written so far'''

    lock: Lock
    '''Guards the queue, the byte totals and the status, which the worker thread and the
       request threads serving addLogNames() both write'''

    thread: Thread


    def __init__(self, logRootPath: str) -> None:
        self.logRootPath = logRootPath
        self.logNamesQueue = []
        self.logNamesAccepted = []
        self.status = UsbOffloadStatus()
        self.bytesTotal = 0
        self.bytesCopied = 0
        self.bytesInFlight = 0
        self.lock = Lock()


    def pathsForLog(self, logName: str):
        '''Returns every file belonging to a log: its .goby, .h5 and anything else sharing its name'''
        return glob.glob(f'{self.logRootPath}/{logName}.*')


    def addLogNames(self, logNames: List[str]):
        '''Queues logs to copy, joining the copy already in progress if there is one'''
        with self.lock:
            isNewCopy = not self.status.isCopying

            if isNewCopy:
                self.logNamesQueue = []
                self.logNamesAccepted = []
                self.status = UsbOffloadStatus(isCopying=True)
                self.bytesTotal = 0
                self.bytesCopied = 0
                self.bytesInFlight = 0

            for logName in logNames:
                if logName in self.logNamesAccepted:
                    continue

                self.logNamesQueue.append(logName)
                self.logNamesAccepted.append(logName)
                self.bytesTotal += sum(os.path.getsize(path) for path in self.pathsForLog(logName))
                self.status.logsTotal += 1

            # Adding logs makes the copy bigger, so the percentage has to fall to match
            self.refreshPercentComplete()

        if isNewCopy:
            self.startCopying()

        return self.getStatus()


    def getStatus(self):
        '''Returns the copy progress, along with whether there is a drive available to copy to'''
        with self.lock:
            # A copy that ended without unmounting - killed by a restart, or an unmount that failed -
            # would hide the drive from findUsbPartition() and grey the button out for good, so
            # reconcile it here, where the client's polling is certain to reach it
            if not self.status.isCopying and os.path.ismount(MOUNT_POINT):
                subprocess.run(['sudo', 'umount', MOUNT_POINT], capture_output=True)

        # A copy in progress has the drive mounted, which is what findUsbPartition() skips on
        self.status.isDriveAvailable = self.status.isCopying or hasUsbDrive()
        return self.status


    def refreshPercentComplete(self):
        '''Recomputes the percentage from the byte totals.  The caller must hold the lock.'''
        written = self.bytesCopied + self.bytesInFlight
        self.status.percentComplete = min(100, int(100 * written / max(self.bytesTotal, 1)))


    def copyQueuedLogs(self):
        '''Mounts the drive, copies queued logs onto it until the queue is empty, then unmounts'''
        destination = f'{MOUNT_POINT}/{DESTINATION_SUBDIR}'

        sudo('mkdir', '-p', MOUNT_POINT)
        sudo('mount', findUsbPartition(), MOUNT_POINT)

        try:
            sudo('mkdir', '-p', destination)

            while True:
                with self.lock:
                    if not self.logNamesQueue:
                        return

                    logName = self.logNamesQueue.pop(0)

                paths = self.pathsForLog(logName)
                logBytes = sum(os.path.getsize(path) for path in paths)

                def onProgress(fraction: float):
                    with self.lock:
                        self.bytesInFlight = logBytes * fraction
                        self.refreshPercentComplete()

                if len(paths) == 0:
                    logging.warning(f'No files found for log: {logName}')
                else:
                    rsyncWithProgress(paths, destination, onProgress)

                with self.lock:
                    self.bytesCopied += logBytes
                    self.bytesInFlight = 0
                    self.status.logsCopied += 1
                    self.refreshPercentComplete()

        finally:
            subprocess.run(['sudo', 'umount', MOUNT_POINT], capture_output=True)


    def startCopying(self):
        def workFunc():
            try:
                # Logs can be queued right up until the moment the drive is unmounted, so only
                # stop once the queue is still empty with the drive already back off
                while True:
                    self.copyQueuedLogs()

                    with self.lock:
                        if not self.logNamesQueue:
                            self.status.isCopying = False
                            return

            except Exception as e:
                logging.error(e)

                with self.lock:
                    self.logNamesQueue = []
                    self.status.errorMessage = str(e)
                    self.status.isCopying = False

        self.thread = Thread(target=workFunc, daemon=True)
        self.thread.start()
