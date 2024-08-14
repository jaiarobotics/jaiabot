##
## Stores data shared between the Flask (main) thread and the streaming client thread
##

from queue import Queue
from typing import *
from pathlib import Path
from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
from google.protobuf.json_format import ParseDict
import threading
import logging
import bisect
import glob
import json


from common.time import utc_now_microseconds

class Data:
    # Dict from hub_id => hubStatus
    hubs = {}

    # Dict from bot_id => botStatus
    bots = {}

    # Dict from bot_id => engineeringStatus
    bots_engineering = {}
    
    # MetaData
    metadata = {}

    # Task Packets
    task_packets = []

    # Path to the .taskpacket files
    task_packet_files_path = "/var/log/jaiabot/bot_offload"
    task_packet_loaded_filenames: Set[str] = set()

    def __init__(self) -> None:
        self.load_taskpacket_files()


    def load_taskpacket_files(self):
        """Appends TaskPackets from *.taskpacket files in the bot_offload directory 
           to the list of all TaskPackets. Removes duplicates between offloaded and live
           TaskPackets and sorts the list by start time.
        Returns: None
        """
        task_packet_filenames = set(glob.glob(self.task_packet_files_path + '/*.taskpacket'))

        taskpacket_filenames_to_load = task_packet_filenames - self.task_packet_loaded_filenames

        for filePath in taskpacket_filenames_to_load:
            logging.warning(f'Loading from {filePath}')
            filePath = Path(filePath)

            for line in open(filePath):
                try:
                    taskPacketDict: Dict = json.loads(line)
                    taskPacket = ParseDict(taskPacketDict, TaskPacket())
                    self.task_packets.append(taskPacket)
                    logging.warning(f'Loaded task packet start_time={taskPacket.start_time}')
                except json.JSONDecodeError as e:
                    logging.warning(f"Error decoding JSON line: {line} because {e}")

        logging.warning(f'Loaded {len(self.task_packets)} task packets')

        self.sort_and_filter_task_packets()


    def sort_and_filter_task_packets(self):
        """Sorts and filters duplicate task packets that can occur after data offloading.
        """
        self.task_packets.sort(key=lambda taskPacket: taskPacket.start_time)

        THRESHOLD_MICROSEC = 1_000_000

        latest_task_packet_start_times: Dict[int, int] = {}

        filtered_task_packets = []

        for task_packet in self.task_packets:
            bot_id = task_packet.bot_id
            start_time = task_packet.start_time

            if bot_id in latest_task_packet_start_times and start_time - latest_task_packet_start_times[bot_id] < THRESHOLD_MICROSEC:
                continue
            else:
                filtered_task_packets.append(task_packet)
            
        self.task_packets = filtered_task_packets


    def get_task_packets(self, bot_ids: Union[Iterable[int], None], start_time_microseconds: Union[int, None], end_time_microseconds: Union[int, None]):
        """Gets a list of task packets occurring during a timespan.

        Args:
            start_time_microseconds (Union[int, None]): The start of the timespan, as a Unix microsecond timestamp.  None means open-ended start time.
            end_time_microseconds (Union[int, None]): The end of the timespan, as a Unix microsecond timestamp.  None means open-ended end time.

        Returns:
            List[TaskPacket]: A list of the task packets, sorted ascending by start_time.
        """
        # Sort the task packets by dates
        self.sort_and_filter_task_packets()

        # Filter by bot_id if we got a set of bot_ids
        if bot_ids is not None:
            bot_ids_set = set(bot_ids)
            filtered_task_packets = list(filter(lambda task_packet: task_packet.bot_id in bot_ids_set, self.task_packets))
        else:
            filtered_task_packets = self.task_packets

        # bisect module doesn't have key functions till python 3.10!
        start_times = [task_packet.start_time for task_packet in filtered_task_packets]

        if start_time_microseconds is not None:
            start_index = bisect.bisect_left(start_times, start_time_microseconds)
        else:
            start_index = 0

        if end_time_microseconds is not None:
            end_index = bisect.bisect_right(start_times, end_time_microseconds)
        else:
            end_index = len(filtered_task_packets)
        
        return filtered_task_packets[start_index:end_index]


    def process_portal_to_client_message(self, msg):
        if msg.HasField('bot_status'):
            msg.bot_status.received_time = utc_now_microseconds()
            self.bots[msg.bot_status.bot_id] = msg.bot_status

        if msg.HasField('engineering_status'):
            self.bots_engineering[msg.engineering_status.bot_id] = msg.engineering_status

        if msg.HasField('hub_status'):            
            msg.hub_status.received_time = utc_now_microseconds()
            self.hubs[msg.hub_status.hub_id] = msg.hub_status
            
        if msg.HasField('task_packet'):
            logging.info('Task packet received')
            packet = msg.task_packet
            self.task_packets.append(packet)

        if msg.HasField('device_metadata'):
            self.metadata = msg.device_metadata


# Access must be locked!    
data = Data()
# protects Data
data_lock = threading.Lock()

# thread safe queue for outbound messages
to_portal_queue = Queue()
