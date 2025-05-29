##
## Stores data shared between the Flask (main) thread and the streaming client thread
##

from queue import Queue
from typing import *
from pathlib import Path
from jaiabot.messages.jaia_dccl_pb2 import TaskPacket
from google.protobuf.json_format import ParseDict, MessageToDict
from google.protobuf.message import Message
import threading
import logging
import bisect
import glob
import json
from pyjaia.task_packet_database import TaskPacketDatabase


from common.time import utc_now_microseconds

log = logging.getLogger()

class Data:
    # Dict from hub_id => hubStatus
    hubs = {}

    # Dict from bot_id => botStatus
    bots = {}

    # Dict from bot_id => engineeringStatus
    bots_engineering = {}
    
    # Dict from hub_id => MetaData
    hub_metadata = {}

    # Task Packets
    task_packet_database = TaskPacketDatabase()

    # Path to the .taskpacket files
    task_packet_files_path = "/var/log/jaiabot/bot_offload"
    task_packet_loaded_filenames: Set[str] = set()

    def __init__(self) -> None:
        pass


    def get_task_packets(self, bot_ids: Union[Iterable[int], None], start_time_microseconds: Union[int, None], end_time_microseconds: Union[int, None]):
        """Gets a list of task packets occurring during a timespan.

        Args:
            start_time_microseconds (Union[int, None]): The start of the timespan, as a Unix microsecond timestamp.  None means open-ended start time.
            end_time_microseconds (Union[int, None]): The end of the timespan, as a Unix microsecond timestamp.  None means open-ended end time.

        Returns:
            List[TaskPacket]: A list of the task packets, sorted ascending by start_time.
        """
        # Update if necessary
        self.task_packet_database.loop()

        # This function returns dictionary representations of the task packets
        task_packet_dicts = self.task_packet_database.query_task_packets(bot_ids=bot_ids, start_utime=start_time_microseconds, end_utime=end_time_microseconds)

        # Convert the dicts into TaskPacket protobuf message objects
        task_packets: List[Message] = list([ParseDict(tp_dict, TaskPacket()) for tp_dict in task_packet_dicts])

        return task_packets


    def process_portal_to_client_message(self, hub_id, msg):
        if msg.HasField('bot_status'):
            msg.bot_status.received_time = utc_now_microseconds()
            self.bots[msg.bot_status.bot_id] = msg.bot_status

        if msg.HasField('engineering_status'):
            self.bots_engineering[msg.engineering_status.bot_id] = msg.engineering_status

        if msg.HasField('hub_status'):            
            msg.hub_status.received_time = utc_now_microseconds()
            self.hubs[msg.hub_status.hub_id] = msg.hub_status
            
        if msg.HasField('task_packet'):
            log.info('Task packet received')
            packet = msg.task_packet
            self.task_packet_database.add_task_packet(MessageToDict(packet, preserving_proto_field_name=True))

        if msg.HasField('device_metadata'):
            self.hub_metadata[hub_id] = msg.device_metadata


# Access must be locked!    
data = Data()
# protects Data
data_lock = threading.Lock()

to_portal_queue = dict()
def create_queues(streaming_endpoints):
    for ep in streaming_endpoints:
        # thread safe queue for outbound messages
        to_portal_queue[ep.hub_id] = Queue()

def get_queue(hub_id):
    return to_portal_queue[hub_id]
