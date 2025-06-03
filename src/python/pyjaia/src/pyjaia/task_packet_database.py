from typing import *
from .utils import get_task_packet_id, utime, now_utime
from datetime import datetime
import glob
from pathlib import Path
import json
import logging
from pprint import pprint
from os.path import getmtime
import sqlite3
import random


l = logging.getLogger('task_packet_database')

class TaskPacketDatabase:
    path: str

    task_packets_version = random.sample(range(2**31), 1)[0]

    # last time the load functions were called
    last_updated_utime = 0
    # Time between checking for task packet files (10 Seconds)
    update_interval = 10_000_000

    latest_taskpacket_mtime = 0


    db: sqlite3.Connection

    def __init__(self, path: str="/var/log/jaiabot/bot_offload/"):
        self.path = path
        self.db = self._open_db()
        self.loop()
    

    def _open_db(self):
        """Open or create the sqlite database that stores the task packets.

        Returns:
            sqlite3.Connection: The database connection.
        """
        db = sqlite3.connect(self.path + '/task_packet.db')

        # Create tables
        db.execute('create table if not exists task_packets (id text primary key on conflict replace, bot_id integer, utime integer, json_string text)')
        db.execute('create table if not exists included (id text primary key, included integer)')
        # Create indices
        db.execute('create index if not exists task_packets$bot_id on task_packets(bot_id)')
        db.execute('create index if not exists task_packets$utime on task_packets(utime)')
        db.execute('create index if not exists task_packets$included on included(included)')
        db.commit()

        return db


    def loop(self):
        # Check if the desired time interval has passed
        if now_utime() < self.last_updated_utime + self.update_interval:
            return
        else:
            self.last_updated_utime = now_utime()
            self.update_from_taskpacket_files()


    def _add_task_packet(self, task_packet: Dict):
        id = get_task_packet_id(task_packet)
        values = (
            id,
            task_packet["bot_id"],
            task_packet["start_time"],
            json.dumps(task_packet)
        )
        self.db.execute('insert or replace into task_packets (id, bot_id, utime, json_string) values (?, ?, ?, ?)', values)
        self.db.execute('insert or ignore into included (id, included) values (?, ?)', (id, True))
        self.task_packets_version += 1


    def add_task_packet(self, task_packet: Dict):
        self._add_task_packet(task_packet)
        self.db.commit()


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

        self.loop()

        conditionals = []
        parameters = []

        if bot_ids is not None:
            conditionals.append(f'where bot_id in ({",".join(bot_ids)})')
            parameters.extend(bot_ids)

        if start_utime is not None:
            conditionals.append(f'where utime >= ?')
            parameters.append(start_utime)

        if end_utime is not None:
            conditionals.append(f'where utime <= ?')
            parameters.append(end_utime)

        if included is not None:
            conditionals.append(f'where included = ?')
            parameters.append(1 if included else 0)

        results = self.db.execute(f'select json_string from task_packets natural join included {"and".join(conditionals)}', parameters)
        return [json.loads(row[0]) for row in results]


    def get_task_packets(self, start_date: datetime, end_date: datetime):
        """Selects TaskPackets between the provided date bounds
        Args:
            start_date (datetime): Provides the lower bound (can be None)
            end_date (datetime): Provides the upper bound (can be None)
        Returns:
            list[dict]: Subset of TaskPacket dicts between specified dates
        """

        start_utime = utime(start_date) if start_date else None
        end_utime = utime(end_date) if end_date else None

        result = {
            "included": self.query_task_packets(bot_ids=None, start_utime=start_utime, end_utime=end_utime, included=True),
            "excluded": self.query_task_packets(bot_ids=None, start_utime=start_utime, end_utime=end_utime, included=False)
        }

        return result
    

    def get_task_packets_version(self) -> int:
        """Gets the version of the set of TaskPackets.  When task packet(s) gets added, removed, changed, etc., the version gets incremented.
        Returns:
            int: The version of the set of TaskPackets
        """
        return self.task_packets_version


    def update_from_taskpacket_files(self):
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
                        self._add_task_packet(taskPacket)
                    except json.JSONDecodeError as e:
                        l.warning(f"Error decoding JSON line: {line} because {e}")

                latest_modified_mtime = max(latest_modified_mtime, taskpacket_mtime)
        
        self.db.commit()
        self.latest_taskpacket_mtime = latest_modified_mtime
    

    def set_task_packet_included(self, task_packet_id: str, included: bool):
        self.db.execute(f'insert or replace into included (included) values (?) where id is ?', (included, task_packet_id))
        self.db.commit()
        self.task_packets_version += 1

