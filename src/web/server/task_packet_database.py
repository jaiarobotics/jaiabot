from typing import *
from utils import *
from datetime import datetime
import glob
from pathlib import Path
import json
import logging
from pprint import pprint


l = logging.getLogger('task_packet_database')


def now_utime():
    return int(datetime.now().timestamp() * 1e6)


class TaskPacketDatabase:
    path: str

    # A map of task_packet_id to task_packet
    all_task_packets: Dict[str, Dict] = {} 

    excluded_task_packet_ids: Set[str] = set()
    task_packets_version = 0
    offloaded_task_packet_files_prev = -1
    offloaded_task_packet_files_curr = 0

    # Set the initial time for checking for task packet files
    next_check_time = now_utime()

    # Time between checking for task packet files (10 Seconds)
    task_packet_check_interval = 10_000_000

    def __init__(self, path: str="/var/log/jaiabot/bot_offload/"):
        self.path = path
    

    def loop(self):
        # Check if the desired time interval has passed
        if now_utime() > self.next_check_time:
            self.load_taskpacket_files()
            self.load_excluded_task_packet_ids()
            
            # Reset the start time
            self.next_check_time = now_utime() + self.task_packet_check_interval
         

    def add_task_packet(self, task_packet: Dict):
        self.all_task_packets[get_task_packet_id(task_packet)] = task_packet
        self.task_packets_version += 1


    def get_task_packets(self, start_date: datetime, end_date: datetime):
        """Selects TaskPackets between the provided date bounds
        Args:
            start_date (datetime): Provides the lower bound (can be None)
            end_date (datetime): Provides the upper bound (can be None)
        Returns:
            list[dict]: Subset of TaskPacket dicts between specified dates
        """

        if start_date is not None:
            start_utime = utime(start_date)
        else:
            start_utime = -1

        if end_date is not None:
            end_utime = utime(end_date)
        else:
            end_utime = 9e99

        results = list(filter(lambda task_packet: start_utime <= int(task_packet['start_time']) <= end_utime, self.all_task_packets.values()))

        return results
    

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
                    self.add_task_packet(taskPacket)
                except json.JSONDecodeError as e:
                    l.warning(f"Error decoding JSON line: {line} because {e}")


    def load_excluded_task_packet_ids(self):
        file_path = self.path + 'excluded_task_packet_ids.json'
        try:
            file = open(file_path, 'r')
        except FileNotFoundError:
            open(file_path, 'w').write('[]\n')
            file = open(file_path, 'r')

        self.excluded_task_packet_ids = set(json.load(file))
    
