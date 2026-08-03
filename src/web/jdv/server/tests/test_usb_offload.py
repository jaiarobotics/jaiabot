#!/usr/bin/env python3

'''Tests for the USB log offload, with the mount and rsync layer stubbed out'''

import json
import os
import sys
import time

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import usb_offload


def lsblkOutput(devices):
    '''Builds the flat lsblk JSON that findUsbPartition() parses'''
    return json.dumps({'blockdevices': devices}).encode()


def disk(name, tran='usb'):
    return {'name': name, 'path': f'/dev/{name}', 'pkname': None, 'tran': tran,
            'fstype': None, 'label': None, 'type': 'disk', 'size': 0, 'mountpoint': None}


def partition(name, pkname, fstype='exfat', label=None, size=1000, mountpoint=None):
    return {'name': name, 'path': f'/dev/{name}', 'pkname': pkname, 'tran': None,
            'fstype': fstype, 'label': label, 'type': 'part', 'size': size,
            'mountpoint': mountpoint}


@pytest.fixture
def fakeLsblk(monkeypatch):
    def setDevices(devices):
        monkeypatch.setattr(usb_offload.subprocess, 'check_output',
                            lambda *args, **kwargs: lsblkOutput(devices))
    return setDevices


@pytest.fixture
def manager(monkeypatch, tmp_path):
    '''A manager whose privileged and slow calls do nothing, over a directory of fake logs'''
    for name, size in (('tiny', 1_000), ('big', 100_000)):
        for extension in ('goby', 'h5'):
            (tmp_path / f'{name}.{extension}').write_bytes(b'x' * (size // 2))

    monkeypatch.setattr(usb_offload, 'sudo', lambda *args: None)
    monkeypatch.setattr(usb_offload.subprocess, 'run', lambda *args, **kwargs: None)
    monkeypatch.setattr(usb_offload, 'findUsbPartition',
                        lambda: {'path': '/dev/fake1', 'fstype': 'exfat'})

    return usb_offload.UsbOffloadManager(str(tmp_path))


def waitUntilIdle(manager, timeout=10):
    deadline = time.time() + timeout

    while time.time() < deadline:
        if not manager.getStatus().isCopying:
            return

        time.sleep(0.01)

    raise AssertionError('copy never finished')


# Choosing the drive

def test_finds_the_one_usb_partition(fakeLsblk):
    fakeLsblk([disk('sda'), partition('sda1', 'sda')])
    assert usb_offload.findUsbPartition()['path'] == '/dev/sda1'


def test_ignores_the_hubs_own_media(fakeLsblk):
    '''The hub boots from USB, and its fleet config card is on USB too'''
    fakeLsblk([disk('sda'), partition('sda1', 'sda'),
               disk('sdb'), partition('sdb1', 'sdb', 'vfat', 'boot', mountpoint='/boot/firmware'),
               partition('sdb2', 'sdb', 'btrfs', 'rootfs', mountpoint='/'),
               partition('sdb3', 'sdb', 'iso9660', 'updates')])
    assert usb_offload.findUsbPartition()['path'] == '/dev/sda1'


def test_ignores_non_usb_disks(fakeLsblk):
    '''An SD card's partitions are hotplug, so the disk's transport is what rules them out'''
    fakeLsblk([disk('mmcblk0', tran=None), partition('mmcblk0p1', 'mmcblk0'),
               disk('sda'), partition('sda1', 'sda')])
    assert usb_offload.findUsbPartition()['path'] == '/dev/sda1'


def test_picks_the_largest_partition_of_one_drive(fakeLsblk):
    '''A single stick can carry an EFI partition beside its data, and is still one drive'''
    fakeLsblk([disk('sda'),
               partition('sda1', 'sda', 'vfat', 'EFI', size=500_000),
               partition('sda2', 'sda', 'exfat', 'DATA', size=64_000_000_000)])
    assert usb_offload.findUsbPartition()['path'] == '/dev/sda2'


def test_raises_when_no_drive_is_plugged_in(fakeLsblk):
    fakeLsblk([disk('sdb'), partition('sdb1', 'sdb', 'btrfs', 'rootfs', mountpoint='/')])
    with pytest.raises(RuntimeError, match='No USB drive found'):
        usb_offload.findUsbPartition()


def test_raises_when_two_drives_are_plugged_in(fakeLsblk):
    fakeLsblk([disk('sda'), partition('sda1', 'sda'),
               disk('sdc'), partition('sdc1', 'sdc')])
    with pytest.raises(RuntimeError, match='2 USB drives found'):
        usb_offload.findUsbPartition()


def test_reports_whether_a_drive_is_available(fakeLsblk):
    fakeLsblk([disk('sda'), partition('sda1', 'sda')])
    assert usb_offload.hasUsbDrive()

    fakeLsblk([disk('sda'), partition('sda1', 'sda', mountpoint='/media/elsewhere')])
    assert not usb_offload.hasUsbDrive()


# Mounting

@pytest.mark.parametrize('fstype, expected', [
    ('ntfs', ['-t', 'ntfs3']),   # plain "ntfs" resolves to the read-only driver
    ('exfat', []),
    ('vfat', []),
    ('ext4', []),
])
def test_names_the_read_write_ntfs_driver_explicitly(monkeypatch, manager, fstype, expected):
    calls = []
    monkeypatch.setattr(usb_offload, 'sudo', lambda *args: calls.append(args))
    monkeypatch.setattr(usb_offload, 'findUsbPartition',
                        lambda: {'path': '/dev/fake1', 'fstype': fstype})
    monkeypatch.setattr(usb_offload, 'rsyncWithProgress', lambda *args: None)

    manager.addLogNames(['tiny'])
    waitUntilIdle(manager)

    mountCall = next(call for call in calls if call[0] == 'mount')
    assert list(mountCall) == ['mount'] + expected + ['/dev/fake1', usb_offload.MOUNT_POINT]


# The queue

def test_copies_every_file_of_every_log(monkeypatch, manager):
    copied = []
    monkeypatch.setattr(usb_offload, 'rsyncWithProgress',
                        lambda paths, destination, onProgress: copied.extend(paths))

    manager.addLogNames(['tiny', 'big'])
    waitUntilIdle(manager)

    assert sorted(os.path.basename(path) for path in copied) == \
        ['big.goby', 'big.h5', 'tiny.goby', 'tiny.h5']
    assert manager.getStatus().logsCopied == 2
    assert manager.getStatus().percentComplete == 100


def test_logs_added_mid_copy_join_the_running_copy(monkeypatch, manager):
    def slowRsync(paths, destination, onProgress):
        time.sleep(0.2)

    monkeypatch.setattr(usb_offload, 'rsyncWithProgress', slowRsync)

    manager.addLogNames(['big'])
    manager.addLogNames(['tiny'])

    assert manager.getStatus().logsTotal == 2
    assert manager.getStatus().isCopying

    waitUntilIdle(manager)
    assert manager.getStatus().logsCopied == 2


def test_asking_for_the_same_log_twice_copies_it_once(monkeypatch, manager):
    copied = []
    monkeypatch.setattr(usb_offload, 'rsyncWithProgress',
                        lambda paths, destination, onProgress: copied.extend(paths))

    manager.addLogNames(['tiny', 'tiny'])
    manager.addLogNames(['tiny'])
    waitUntilIdle(manager)

    assert manager.getStatus().logsTotal == 1
    assert len(copied) == 2   # tiny.goby and tiny.h5, copied once


def test_percentage_is_weighted_by_bytes(monkeypatch, manager):
    '''A tiny log finishing must not report the copy as half done when a large one remains'''
    percentWhenBigStarted = []

    def rsync(paths, destination, onProgress):
        if 'big' in os.path.basename(paths[0]):
            percentWhenBigStarted.append(manager.getStatus().percentComplete)

    monkeypatch.setattr(usb_offload, 'rsyncWithProgress', rsync)

    manager.addLogNames(['tiny', 'big'])
    waitUntilIdle(manager)

    # tiny is 1% of the bytes, so counting logs instead would have claimed 50% here
    assert percentWhenBigStarted == [0]
    assert manager.getStatus().percentComplete == 100


def test_a_log_deleted_before_it_is_copied_is_not_reported_as_copied(monkeypatch, manager):
    monkeypatch.setattr(usb_offload, 'rsyncWithProgress', lambda *args: None)

    manager.addLogNames(['tiny', 'vanished'])
    waitUntilIdle(manager)

    status = manager.getStatus()
    assert status.logsCopied == 1
    assert status.logsTotal == 1


def test_log_names_are_matched_literally_not_as_glob_patterns(manager):
    assert manager.pathsForLog('tiny') != []
    assert manager.pathsForLog('*') == []
    assert manager.pathsForLog('tin?') == []


def test_a_failure_stops_the_copy_and_is_reported(monkeypatch, manager):
    def failingRsync(paths, destination, onProgress):
        raise RuntimeError('No space left on device')

    monkeypatch.setattr(usb_offload, 'rsyncWithProgress', failingRsync)

    manager.addLogNames(['tiny', 'big'])
    waitUntilIdle(manager)

    status = manager.getStatus()
    assert status.errorMessage == 'No space left on device'
    assert not status.isCopying
    assert manager.logNamesQueue == []
