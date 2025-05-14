from typing import *
from utils import *
from datetime import datetime
import bisect
import glob
from pathlib import Path
import json
import logging


l = logging.getLogger('task_packet_database')


def now():
    return int(datetime.now().timestamp() * 1e6)


class TaskPacketDatabase:
    path: str

    all_task_packets: List[Dict] = []
    excluded_task_packet_ids: List[str] = []
    task_packets_version = 0
    offloaded_task_packet_files_prev = -1
    offloaded_task_packet_files_curr = 0

    # Set the initial time for checking for task packet files
    start_task_packet_check_time = now()

    # Time between checking for task packet files (10 Seconds)
    task_packet_check_interval = 10_000_000

    def __init__(self, path: str="/var/log/jaiabot/bot_offload/"):
        self.path = path
    

    def loop(self):
        # Check if the desired time interval has passed
        if now() - self.start_task_packet_check_time >= self.task_packet_check_interval:
            self.load_taskpacket_files()
            
            # Reset the start time
            self.start_task_packet_check_time = now()
         

    def add_task_packet(self, task_packet: Dict):
        self.all_task_packets.append(task_packet)
        self.task_packets_version += 1


    def get_task_packets_subset(self, start_date, end_date):
        """Selects TaskPackets between the provided date bounds
        Args:
            start_date (str): Provides the lower bound
            end_date (str): Provides the upper bound
        Returns:
            list: Subset of TaskPackets between specified dates
        """
        start_index = bisect.bisect_left(
            list(map(lambda task_packet: int(task_packet['start_time']),  self.all_task_packets)), 
            utime(start_date)
        )

        if end_date == "":
            end_index = len(self.all_task_packets)
        else:
            end_index = bisect.bisect_right(
                list(map(lambda task_packet: int(task_packet['start_time']),  self.all_task_packets)),
                utime(end_date)
            )

        return self.all_task_packets[start_index: end_index]


    def get_task_packets(self, start_date, end_date):
        if start_date is None or end_date is None:
            return []

        return self.get_task_packets_subset(start_date, end_date)
    

    def get_task_packets_version(self) -> int:
        """Gets the version of the set of TaskPackets.  When task packet(s) gets added, removed, changed, etc., the version gets incremented.
        Returns:
            int: The version of the set of TaskPackets
        """
        return self.task_packets_version


    def load_taskpacket_files(self):
        """Appends TaskPackets from *.taskpacket files in the bot_offload directory 
           to the list of all TaskPackets. Removes duplicates between offloaded and live
           TaskPackets and sorts the list by start time.
        Returns: None
        """
        self.offloaded_task_packet_file_curr = len(glob.glob(self.path + '*.taskpacket'))

        if self.offloaded_task_packet_file_curr != self.offloaded_task_packet_files_prev:
            self.offloaded_task_packet_files_prev = self.offloaded_task_packet_file_curr
        else:
            return

        for filePath in glob.glob(self.path + '*.taskpacket'):
            filePath = Path(filePath)

            for line in open(filePath):
                try:
                    taskPacket: Dict = json.loads(line)
                    self.all_task_packets.append(taskPacket)
                    self.task_packets_version += 1
                except json.JSONDecodeError as e:
                    l.warning(f"Error decoding JSON line: {line} because {e}")

        self.all_task_packets = filterDuplicateTaskPackets(self.all_task_packets)
        self.all_task_packets.sort(key=lambda taskPacket: int(taskPacket['start_time']))


def filterDuplicateTaskPackets(taskPackets: List[dict]):
    """Filters duplicate task packets that can occur after data offloading. This works
    by indexing the task packets by a (bot_id, reduced_time) tuple and checking neighboring
    reduced_time values for duplicates.

    Args:
        taskPackets (List[dict]): Unfiltered list of task packets.
    Returns:
        (List[dict]): Filtered list of task packets.
    """
    # Maps (bot_id, reduced_time) to TaskPacket
    taskPacketLookup: Dict[tuple, dict] = {}

    for taskPacket in taskPackets:
        bot_id = taskPacket['bot_id']
        reducedStartTime = reduceTime(taskPacket['start_time'])

        # Check neighboring bins as well for task packets, just in case start_time was on
        # the cusp of being rounded up/down
        if (bot_id, reducedStartTime) in taskPacketLookup or \
           (bot_id, reducedStartTime - 1) in taskPacketLookup or \
           (bot_id, reducedStartTime + 1) in taskPacketLookup:
            continue
        else:
            taskPacketLookup[(bot_id, reducedStartTime)] = taskPacket
        
    return list(taskPacketLookup.values())

def reduceTime(time: int):
        """Does integer division to give the floored Unix timestamp in seconds.

        Args:
            time (int): Unix timestamp in microseconds.

        Returns:
            int: Unix timestamp in seconds, rounded down.
        """
        # This BIN_LENGTH can be adjusted if desired, but DCCL time2 codec rounds to the nearest 
        # second, (1 million microseconds)
        BIN_LENGTH = 1_000_000
        return int(time) // BIN_LENGTH
