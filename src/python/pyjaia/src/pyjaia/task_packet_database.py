from typing import *
from .utils import get_task_packet_id, utime, now_utime
from datetime import datetime
import glob
from pathlib import Path
import json
import logging
from pprint import pprint
from os.path import getmtime


l = logging.getLogger('task_packet_database')

class TaskPacketDatabase:
    path: str

    # A map of task_packet_id to task_packet
    all_task_packets: Dict[str, Dict] = {} 

    excluded_task_packet_ids: Set[str] = set()
    task_packets_version = 0

    # last time the load functions were called
    last_updated_utime = 0
    # Time between checking for task packet files (10 Seconds)
    update_interval = 10_000_000

    # Latest mtime that we've already loaded
    latest_taskpacket_mtime = 0
    latest_excluded_taskpacket_mtime = 0

    def __init__(self, path: str="/var/log/jaiabot/bot_offload/"):
        self.path = path
        self.loop()
    

    def loop(self):
        # Check if the desired time interval has passed
        if now_utime() < self.last_updated_utime + self.update_interval:
            return
        else:
            self.last_updated_utime = now_utime()
            self.load_taskpacket_files()
            self.load_excluded_task_packet_ids()
            
         

    def add_task_packet(self, task_packet: Dict):
        self.all_task_packets[get_task_packet_id(task_packet)] = task_packet
        self.task_packets_version += 1


    def query_task_packets(self, bot_ids: Union[Iterable[int], None]=None, start_utime: Union[int, None]=None, end_utime: Union[int, None]=None, included: Union[bool, None]=None):
        """Queries the task packets.

        Args:
            bot_ids (Union[Iterable[int], None]): List of bot_ids.
            start_utime (Union[int, None]): Start of time window (or None if no minimum time)
            end_utime (Union[int, None]): End of time window (or None if no maximum time)
            included (Union[bool, None]): Included or excluded task packets (None for both types)

        Returns:
            list[dict]: A list of task packets that match the criteria.
        """
        results = self.all_task_packets.values()

        if bot_ids is not None:
            results = filter(lambda tp: tp["bot_id"] in bot_ids, results)

        if start_utime is not None:
            results = filter(lambda tp: int(tp["start_time"]) >= start_utime, results)

        if end_utime is not None:
            results = filter(lambda tp: int(tp["start_time"]) <= end_utime, results)

        if included is not None:
            results = filter(lambda tp: (get_task_packet_id(tp) in self.excluded_task_packet_ids) != included, results)

        return list(results)


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

        result = {
            "included": [],
            "excluded": []
        }

        for task_packet in self.all_task_packets.values():
            if not (start_utime <= int(task_packet['start_time']) <= end_utime):
                # Outside requested time range
                continue

            task_packet_id = get_task_packet_id(task_packet)

            if get_task_packet_id(task_packet) in self.excluded_task_packet_ids:
                result["excluded"].append(task_packet)
            else:
                result["included"].append(task_packet)

        return result
    

    def get_task_packets_version(self) -> int:
        """Gets the version of the set of TaskPackets.  When task packet(s) gets added, removed, changed, etc., the version gets incremented.
        Returns:
            int: The version of the set of TaskPackets
        """
        return self.task_packets_version


    def load_taskpacket_files(self):
        """Loads all modified taskpacket files from the offload directory.
        """

        latest_modified_mtime = 0
        for taskpacket_filename in glob.glob(self.path + '*.taskpacket'):

            taskpacket_mtime = getmtime(taskpacket_filename)

            if taskpacket_mtime > self.latest_taskpacket_mtime:
                l.info(f'Loading modified taskpacket file: {taskpacket_filename}')
                for line in open(taskpacket_filename):
                    try:
                        taskPacket: Dict = json.loads(line)
                        self.add_task_packet(taskPacket)
                    except json.JSONDecodeError as e:
                        l.warning(f"Error decoding JSON line: {line} because {e}")

                latest_modified_mtime = max(latest_modified_mtime, taskpacket_mtime)
        
        self.latest_taskpacket_mtime = latest_modified_mtime


    def load_excluded_task_packet_ids(self):
        """Load the excluded task packet file, if it's been modified.
        """
        file_path = self.path + 'excluded_task_packet_ids.json'
        excluded_taskpacket_mtime = getmtime(file_path)

        if excluded_taskpacket_mtime <= self.latest_excluded_taskpacket_mtime:
            # File hasn't changed
            return

        try:
            file = open(file_path, 'r')
            self.excluded_task_packet_ids = set(json.load(file))
            self.latest_excluded_taskpacket_mtime = excluded_taskpacket_mtime
            l.info(f"Loaded {len(self.excluded_task_packet_ids)} excluded task packet ids")
        except (FileNotFoundError, json.decoder.JSONDecodeError) as e:
            l.info(e)
            self.excluded_task_packet_ids = set([])
            self.save_excluded_task_packet_ids()


    def save_excluded_task_packet_ids(self):
        file_path = self.path + 'excluded_task_packet_ids.json'
        with open(file_path, 'w') as file:
            json.dump(list(self.excluded_task_packet_ids), file)
    

    def set_task_packet_included(self, task_packet_id: str, included: bool):
        if included:
            try:
                self.excluded_task_packet_ids.remove(task_packet_id)
            except KeyError:
                l.warning(f'task_packet_id "{task_packet_id}" was not excluded, no need to remove it.')
        else:
            self.excluded_task_packet_ids.add(task_packet_id)

        self.save_excluded_task_packet_ids()
        self.task_packets_version += 1

