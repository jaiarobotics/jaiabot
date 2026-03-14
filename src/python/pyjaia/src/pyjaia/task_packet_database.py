from typing import *
from .utils import get_task_packet_id, utime
from datetime import datetime
import glob
import json
import logging
from pprint import pprint
from os.path import getmtime
import sqlite3
import random
import os
import os.path
import threading
import shutil


l = logging.getLogger('task_packet_database')


class TaskPacketDatabase:
    taskpacket_files_path: str = "/var/log/jaiabot/bot_offload/"
    database_path: str= "/var/log/jaiabot/db"

    task_packets_version = random.sample(range(2**31), 1)[0]

    db: sqlite3.Connection
    _lock: threading.Lock

    def __init__(self, taskpacket_files_path: str=None, database_path: str=None):
        self.taskpacket_files_path = taskpacket_files_path or self.taskpacket_files_path
        self.database_path = database_path or self.database_path
        self._lock = threading.Lock()

        self.db = self._create_or_open_db()
        self._update()
    

    def _create_or_open_db(self):
        """Open or create the sqlite database that stores the task packets.

        Returns:
            sqlite3.Connection: The database connection.
        """
        os.makedirs(self.database_path, exist_ok=True)
        filename = self.database_path + '/task_packet.db'
        db = sqlite3.connect(filename, check_same_thread=False)

        # Create tables

        # `task_packets` table contains the actual TaskPacket data
        # * id is the task_packet_id
        # * bot_id is the id of the Bot that generated the task packet
        # * utime is the unix timestamp of when the task packet was generated
        # * json_string is the full task packet as a json string.  We use json_string instead of individual columns 
        #   for flexibility and to avoid having to migrate the database every time we change the task packet schema.
        db.execute('create table if not exists task_packets (id text primary key on conflict replace, bot_id integer, utime integer, json_string text)')

        # `included` table contains the task_packet_ids and their included boolean.  
        #   We separate this from the main task_packets table to make it more efficient to query included vs excluded 
        #   task packets without having to read the full json_string
        db.execute('create table if not exists included (id text primary key, included integer)')

        # `mission_name` table contains the task_packet_ids and their mission names.  This is used for querying task 
        #   packets by mission name.
        db.execute('create table if not exists mission_name (id text primary key, mission_name text)')

        # Create indices
        db.execute('create index if not exists task_packets$bot_id on task_packets(bot_id)')
        db.execute('create index if not exists task_packets$utime on task_packets(utime)')
        db.execute('create index if not exists task_packets$included on included(included)')
        db.execute('create index if not exists mission_name$mission_name on mission_name(mission_name)')
        db.commit()

        return db
    

    def _update(self):
        """Updates taskpacket files from disk, if enough time has passed.  THREAD UNSAFE.
        """
        self._update_from_taskpacket_files()


    def _update_from_taskpacket_files(self):
        """Loads all modified taskpacket files from the offload directory.  THREAD UNSAFE.
        """

        processed_path = self.database_path + '/processed/'
        os.makedirs(processed_path, exist_ok=True)

        for taskpacket_fullpath in glob.glob(self.taskpacket_files_path + '*.taskpacket'):
            l.info(f'Loading modified taskpacket file: {taskpacket_fullpath}')
            for line in open(taskpacket_fullpath):
                try:
                    taskPacket: Dict = json.loads(line)
                    self._add_task_packet(taskPacket)
                except json.JSONDecodeError as e:
                    l.warning(f"Error decoding JSON line: {line} because {e}")

            # Move file to prevent us from finding it again next time (speeds things up significantly)
            taskpacket_filename = os.path.basename(taskpacket_fullpath)
            shutil.move(taskpacket_fullpath, processed_path + taskpacket_filename)
            self.task_packets_version += 1
        
        self.db.commit()
    

    def _add_task_packet(self, task_packet: Dict):
        """Adds a task packet to the database.  THREAD UNSAFE.  Does not increment task_packets_version.

        Args:
            task_packet (Dict): New task packet dictionary to add.
        """
        id = get_task_packet_id(task_packet)
        values = (
            id,
            task_packet["bot_id"],
            task_packet["start_time"],
            json.dumps(task_packet)
        )
        self.db.execute('insert or replace into task_packets (id, bot_id, utime, json_string) values (?, ?, ?, ?)', values)
        self.db.execute('insert or ignore into included (id, included) values (?, ?)', (id, True))

        # Task packets that are offloaded from a Bot will not have a mission_name field, but task packets that 
        #   are published interprocess by the hub manager will have a mission_name field (set based on the mission 
        #   id to name mapping in the hub manager).  So we only add to the mission_name table if the mission_name 
        #   field is present in the task packet.
        if 'mission_name' in task_packet:
            self.db.execute('insert or replace into mission_name (id, mission_name) values (?, ?)', (id, task_packet["mission_name"]))


    def add_task_packet(self, task_packet: Dict):
        """Adds a new task packet to the database.

        Args:
            task_packet (Dict): New task packet dictionary to add.
        """
        with self._lock:
            self._add_task_packet(task_packet)
            self.db.commit()
            self.task_packets_version += 1

    def add_task_packets_from_files(self):
        """Loads all modified taskpacket files from the offload directory."""
        with self._lock:
            self._update()

    def query_task_packets(self, 
                           bot_ids: Union[Iterable[int], None]=None, 
                           start_utime: Union[int, None]=None, 
                           end_utime: Union[int, None]=None, 
                           included: Union[bool, None]=None, 
                           mission_names: Union[str, List[str], None]=None) -> List[Dict]:
        """Queries the task packets.

        Args:
            bot_ids (Union[Iterable[int], None]): List of bot_ids.
            start_utime (Union[int, None]): Start of time window (or None if no minimum time)
            end_utime (Union[int, None]): End of time window (or None if no maximum time)
            included (Union[bool, None]): Included or excluded task packets (None for both types)
            mission_names (Union[str, List[str], None]): Mission name(s) to filter by (None for all)
        Returns:
            list[dict]: A list of task packets that match the criteria.
        """

        with self._lock:
            self._update()

            conditionals = []
            parameters = []
            from_clause = ' from task_packets'

            if bot_ids is not None:
                conditionals.append(f'bot_id in ({",".join(["?"] * len(bot_ids))})')
                parameters.extend(bot_ids)

            if start_utime is not None:
                conditionals.append(f'utime >= ?')
                parameters.append(start_utime)

            if end_utime is not None:
                conditionals.append(f'utime <= ?')
                parameters.append(end_utime)

            if included is not None:
                conditionals.append(f'included = ?')
                parameters.append(1 if included else 0)
                from_clause += ' natural join included'

            if mission_names is not None:
                if isinstance(mission_names, str):
                    mission_names = [mission_names]
                conditionals.append(f'mission_name in ({",".join(["?"] * len(mission_names))})')
                parameters.extend(mission_names)
                from_clause += ' natural join mission_name'

            query_string = f'select json_string {from_clause}'
            if len(conditionals) > 0:
                query_string = query_string + " where " + " and ".join(conditionals)

            query_string = query_string + ' order by utime desc limit 1000'

            l.debug(f"Executing query: {query_string} with parameters {parameters}")

            results_json = self.db.execute(query_string, parameters)
            results: List[Dict] = [json.loads(row[0]) for row in results_json]
            return results


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
        with self._lock:
            l.info('getting task packet version')
            return self.task_packets_version


    def set_task_packet_included(self, task_packet_id: str, included: bool):
        """Sets the included boolean for a particular task_packet_id.

        Args:
            task_packet_id (str): The id of the task packet to alter.
            included (bool): True if we should include this task packet in contours and interpolated drifts.
        """
        with self._lock:
            self.db.execute(f'insert or replace into included (id, included) values (?, ?)', (task_packet_id, 1 if included else 0))
            self.db.commit()
            self.task_packets_version += 1
