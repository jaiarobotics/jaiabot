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

DESTINATION_SUBDIR = 'jaia-logs'

RESERVED_LABELS = ['rootfs', 'boot', 'data', 'updates', 'overlay']
'''Filesystem labels of the hub's own media, which is never the operator's drive'''

PROGRESS_RE = re.compile(r'(\d+)%')
'''Matches the percentage in rsync --info=progress2 output'''


@dataclass_json
@dataclass
class UsbOffloadStatus:
    '''Progress of the current (or most recent) copy of logs to a USB drive'''

    isCopying: bool = False

    logsCopied: int = 0

    logsTotal: int = 0
    '''Grows when more logs are added while the copy runs'''

    percentComplete: int = 0
    '''Measured by bytes, so a large log counts for more than a small one'''

    errorMessage: Optional[str] = None

    isDriveAvailable: bool = False


def findUsbPartition():
    '''Returns the lsblk record of the USB partition plugged into the hub, raising unless there is exactly one'''
    output = subprocess.check_output(
        ['lsblk', '-J', '-l', '-b', '-o', 'NAME,PATH,PKNAME,TRAN,FSTYPE,LABEL,TYPE,SIZE,MOUNTPOINT'])
    devices = json.loads(output)['blockdevices']

    # lsblk only nests partitions under their disk when the NAME column is asked for, so take the
    # flat list and pair them up by PKNAME.  Match on transport: an SD card is hotplug but not USB.
    usbDiskNames = {device['name'] for device in devices
                    if device['type'] == 'disk' and device['tran'] == 'usb'}

    # The fleet config card is on USB too, so skip the hub's own media.  Both checks are needed:
    # fstab mounts the config card at boot, but our ansible tasks leave it unmounted.
    partitions = [device for device in devices
                  if device['type'] == 'part'
                  and device['pkname'] in usbDiskNames
                  and device['fstype'] is not None
                  and device['mountpoint'] is None
                  and device['label'] not in RESERVED_LABELS]

    disksFound = {partition['pkname'] for partition in partitions}

    if len(disksFound) == 0:
        raise RuntimeError("No USB drive found.  Please plug a drive into one of the hub's USB ports.")

    if len(disksFound) > 1:
        raise RuntimeError(f'{len(disksFound)} USB drives found.  Please plug in only one drive.')

    # One drive often holds more than one partition, so take the largest: the one with room for logs
    return max(partitions, key=lambda partition: partition['size'])


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

       rsync rather than cp so a full drive leaves no truncated file posing as a whole log, and
       without -a because preserving ownership fails on the FAT filesystems most drives use.'''
    # stderr is merged in rather than given its own pipe, which nothing would read until rsync had
    # already exited - long enough for a chatty failure to fill that pipe and deadlock the copy
    process = subprocess.Popen(['sudo', 'rsync', '--info=progress2', *paths, destination],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    messages = []

    # progress2 ends each update with a carriage return; text=True makes readline() return on those
    for line in process.stdout:
        match = PROGRESS_RE.search(line)

        if match is not None:
            onProgress(int(match.group(1)) / 100)
        elif line.strip():
            messages.append(line.strip())

    if process.wait() != 0:
        raise RuntimeError(' '.join(messages[-3:]) or 'rsync failed')


class UsbOffloadManager:
    '''Copies logs to a USB drive on a background thread, one log at a time.

       Logs added while a copy is running join that copy rather than being turned away, so the
       operator can keep browsing, selecting and queueing logs without waiting for it to finish.'''

    logRootPath: str
    logNamesQueue: List[str]
    status: UsbOffloadStatus

    logNamesAccepted: List[str]
    '''Every log taken into this copy, so asking for one twice does not copy it twice'''

    bytesTotal: int

    bytesCopied: int

    bytesInFlight: float
    '''How much of the log being copied right now rsync has written'''

    lock: Lock
    '''Guards the queue, the byte totals and the status, which the worker thread and the
       request threads both write'''

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
        # Escaped so that a name containing *, ? or [ is matched literally rather than as a pattern
        return glob.glob(f'{self.logRootPath}/{glob.escape(logName)}.*')


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
            # A copy killed before it could unmount would hide the drive from findUsbPartition()
            # for good, so reconcile it here, where the client's polling is certain to reach it
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

        partition = findUsbPartition()

        # The kernel's read-write NTFS driver registers as ntfs3, while the "ntfs" that lsblk
        # reports resolves to the read-only one, which would fail the copy partway through
        fsTypeArgs = ['-t', 'ntfs3'] if partition['fstype'] == 'ntfs' else []

        sudo('mkdir', '-p', MOUNT_POINT)
        sudo('mount', *fsTypeArgs, partition['path'], MOUNT_POINT)

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
                    # Deleted since it was queued, so drop it rather than report it as copied
                    logging.warning(f'No files found for log: {logName}')

                    with self.lock:
                        self.status.logsTotal -= 1
                        self.refreshPercentComplete()

                    continue

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
                # Logs can arrive right up to the moment the drive is unmounted, so only stop
                # once the queue is still empty with the drive already back off
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
