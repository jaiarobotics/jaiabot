from google.protobuf.json_format import ParseDict
from typing import *

from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
from .utils import get_task_packet_id, utime
from datetime import datetime
import glob
import json
import logging
import sqlite3
import random
import os
import os.path
import threading
import shutil

from jaiabot.messages.mission_pb2 import MissionSummary


l = logging.getLogger('task_packet_database')


# UTIME_PADDING is a small amount of time (in microseconds) that we pad the start and end times with when querying, 
# to account for rounding from the dccl.time encoding
UTIME_PADDING = 1_000_000

def dccl_time_round(utime: int, round_to: int=1_000_000) -> int:
    """Rounds a unix microsecond timestamp to the nearest round_to microseconds.
    This accounts for how dccl rounds time values to/from the bots.

    Args:
        utime (int): The unix microsecond timestamp to round.
        round_to (int): The number of microseconds to round to.  Default is 1 second (1,000,000 microseconds).

    Returns:
        int: The rounded unix microsecond timestamp.
    """
    return (int(utime) + round_to // 2) // round_to * round_to


def sql_set_placeholders(values: list[Any]) -> str:
    """Returns a string of SQL placeholders for the given list of values.  For example, if the input list has 3 values, the output will be "(?, ?, ?)".

    Args:
        values (list[Any]): The list of values to create placeholders for.

    Returns:
        str: A string of SQL placeholders for the given list of values.
    """
    placeholders = ", ".join(["?"] * len(values))
    return f'({placeholders})'


class TaskPacketDatabase:
    taskpacket_files_path: str = "/var/log/jaiabot/bot_offload/"
    database_path: str= "/var/log/jaiabot/db"

    task_packets_version = random.sample(range(2**31), 1)[0]

    db: sqlite3.Connection
    _lock: threading.Lock

    def __init__(self, taskpacket_files_path: str | None=None, database_path: str | None=None):
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
        db.execute('create index if not exists task_packets$bot_id on task_packets(bot_id)')
        db.execute('create index if not exists task_packets$utime on task_packets(utime)')

        # `included` table contains the task_packet_ids and their included boolean.  
        #   We separate this from the main task_packets table to make it more efficient to query included vs excluded 
        #   task packets without having to read the full json_string
        db.execute('create table if not exists included (id text primary key, included integer)')
        db.execute('create index if not exists included$included on included(included)')

        # `mission_name` table contains the task_packet_ids and their mission names.  This is used for querying task 
        #   packets by mission name.
        db.execute('create table if not exists mission_name (id text primary key, mission_name text)')
        db.execute('create index if not exists mission_name$mission_name on mission_name(mission_name)')

        # mission_commands stores the mission_name.  In case of a power cycle, the hub_manager will not be able to populate
        # the mission_name field, and in that case we consult this table.
        db.execute('create table if not exists mission_commands (mission_name text, bot_id, mission_command_time integer)')
        db.execute('create index if not exists mission_commands$bot_id on mission_commands(bot_id)')
        db.execute('create index if not exists mission_commands$mission_command_time on mission_commands(mission_command_time)')

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
    

    def add_mission_command(self, mission_name: str, bot_id: int, mission_command_time: int):
        """Adds a mission command to the database.  Thread safe.

        Args:
            mission_name (str): The name of the mission.
            bot_id (int): The id of the bot that received the mission command.
            mission_command_time (int): The time of the mission command, as a unix microsecond timestamp.
        """
        with self._lock:
            mission_command_time_dccl = dccl_time_round(mission_command_time)
            self.db.execute('insert into mission_commands (mission_name, bot_id, mission_command_time) values (?, ?, ?)', (mission_name, bot_id, mission_command_time_dccl))
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
        elif 'mission_command_time' in task_packet:
            # It's possible we know about this task packet's mission_name, but a power cycle occurred. We can retrieve it from the
            # mission_commands table based on the bot_id and the task_packet's mission_command_time.
            mission_command_time_dccl = dccl_time_round(task_packet['mission_command_time'])
            rows = self.db.execute('select mission_name from mission_commands where bot_id = ? and mission_command_time = ?', (task_packet["bot_id"], mission_command_time_dccl))
            row = rows.fetchone()
            if row is not None:
                mission_name = row[0]
                self.db.execute('insert or replace into mission_name (id, mission_name) values (?, ?)', (id, mission_name))


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

    def query_task_packets_as_dicts(self, 
                           bot_ids: Union[Iterable[int], None]=None, 
                           start_utime: Union[int, None]=None, 
                           end_utime: Union[int, None]=None, 
                           included: Union[bool, None]=True, 
                           mission_names: Union[Iterable[str], None]=None) -> List[Dict]:
        """Queries the task packets.

        Args:
            bot_ids (Union[Iterable[int], None]): List of bot_ids.
            start_utime (Union[int, None]): Start of time window (or None if no minimum time)
            end_utime (Union[int, None]): End of time window (or None if no maximum time)
            included (Union[bool, None]): Included or excluded task packets (None for both types)
            mission_names (Union[Iterable[str], None]): Mission name(s) to filter by (None for all)
        Returns:
            list[dict]: A list of task packet dictionaries that match the criteria.
        """

        with self._lock:
            self._update()

            conditionals = []
            parameters = []
            from_clause = ' from task_packets'

            bot_ids = list(bot_ids) if bot_ids is not None else []
            if len(bot_ids) > 0:
                conditionals.append(f'bot_id in {sql_set_placeholders(bot_ids)}')
                parameters.extend(bot_ids)

            if start_utime is not None:
                conditionals.append(f'utime >= ?')
                parameters.append(start_utime - UTIME_PADDING)

            if end_utime is not None:
                conditionals.append(f'utime <= ?')
                parameters.append(end_utime + UTIME_PADDING)

            if included is not None:
                conditionals.append(f'included = ?')
                parameters.append(1 if included else 0)
                from_clause += ' natural join included'

            if mission_names is not None:
                mission_names = list(mission_names)
                if len(mission_names) == 0:
                    return []

                conditionals.append(f'mission_name in {sql_set_placeholders(mission_names)}')
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


    def query_mission_summaries(self, bot_ids: Union[Iterable[int], None], 
                              start_utime: Union[int, None]=None, 
                              end_utime: Union[int, None]=None,
                              utime_padding: int=1_000_000) -> List[MissionSummary]:
        """Gets a list of mission summaries for missions occurring during a timespan.
        
        Args:            
            bot_ids (Union[List[int], None]): If not None, only return mission summaries for missions with a bot_id in this list.
            start_utime (Union[int, None]): The start of the timespan, as a Unix microsecond timestamp.  None means open-ended start time.
            end_utime (Union[int, None]): The end of the timespan, as a Unix microsecond timestamp.  None means open-ended end time.
            utime_padding (int): Padding to apply to the start and end times, in microseconds. Default is 1 second (1,000,000 microseconds).  This is to account for any potential rounding issues with the utime values in the database.

        Returns:
            list[MissionSummary]: A list of mission summaries that match the criteria.
        """

        with self._lock:
            self._update()

            conditionals = []
            parameters = []

            bot_ids = list(bot_ids) if bot_ids is not None else []
            if len(bot_ids) > 0:
                conditionals.append(f'bot_id in {sql_set_placeholders(bot_ids)}')
                parameters.extend(bot_ids)

            if start_utime is not None:
                conditionals.append(f'utime >= ?')
                parameters.append(start_utime - utime_padding)

            if end_utime is not None:
                conditionals.append(f'utime <= ?')
                parameters.append(end_utime + utime_padding)

            query_string = f'select utime, mission_name from task_packets natural join mission_name'
            if len(conditionals) > 0:
                query_string = query_string + " where " + " and ".join(conditionals)

            query_string = query_string + ' order by utime desc limit 1000'

            l.debug(f"Executing query: {query_string} with parameters {parameters}")

            rows = self.db.execute(query_string, parameters)

            # mission_name => MissionSummary
            mission_summaries: Dict[str, MissionSummary] = {}

            for row in rows:
                utime, mission_name = row
                mission_summary = mission_summaries.get(mission_name, MissionSummary(mission_name=mission_name))
                if mission_summary.start_time == 0 or utime < mission_summary.start_time:
                    mission_summary.start_time = utime
                if mission_summary.end_time == 0 or utime > mission_summary.end_time:
                    mission_summary.end_time = utime
                mission_summary.task_packet_count += 1
                mission_summaries[mission_name] = mission_summary

            # Return MissionSummaries sorted by start_time ascending
            return sorted(mission_summaries.values(), key=lambda ms: ms.start_time)


    def query_task_packets(self, 
                           bot_ids: Union[Iterable[int], None]=None, 
                           start_utime: Union[int, None]=None, 
                           end_utime: Union[int, None]=None, 
                           included: Union[bool, None]=True,
                           mission_names: Union[Iterable[str], None]=None) -> List[TaskPacket]:
        """Queries the task packets and returns them as protobuf objects.

        Args:
            bot_ids (Union[Iterable[int], None]): List of bot_ids.
            start_utime (Union[int, None]): Start of time window (or None if no minimum time)
            end_utime (Union[int, None]): End of time window (or None if no maximum time)
            included (Union[bool, None]): Included or excluded task packets (None for both types)
            mission_names (Union[Iterable[str], None]): List of mission names to filter by (None for all missions)

        Returns:
            list[TaskPacket]: A list of task packets that match the criteria, as protobuf objects.
        """
        taskpacket_dicts = self.query_task_packets_as_dicts(bot_ids=bot_ids, start_utime=start_utime, end_utime=end_utime, included=included, mission_names=mission_names)

        return [ParseDict(tp_dict, TaskPacket(), ignore_unknown_fields=True) for tp_dict in taskpacket_dicts]



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
            "included": self.query_task_packets_as_dicts(bot_ids=None, start_utime=start_utime, end_utime=end_utime, included=True),
            "excluded": self.query_task_packets_as_dicts(bot_ids=None, start_utime=start_utime, end_utime=end_utime, included=False)
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
