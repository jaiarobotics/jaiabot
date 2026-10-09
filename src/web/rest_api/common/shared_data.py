##
## Stores data shared between the Flask (main) thread and the streaming client thread
##

from queue import Queue
from typing import *
from google.protobuf.json_format import MessageToDict
import threading
import logging

# Jaia
from common.time import utc_now_microseconds
from pyjaia.task_packet_database import TaskPacketDatabase

# Messages
from jaiabot.messages.hub_pb2 import HubStatus
from jaiabot.messages.jaia_dccl_pb2 import BotStatus, ContactUpdate
from jaiabot.messages.mission_pb2 import MissionPlan
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.metadata_pb2 import DeviceMetadata
from jaiabot.messages.portal_pb2 import PortalToClientMessage


log = logging.getLogger()

class Data:
    # Dict from hub_id => hubStatus
    hubs: Dict[int, HubStatus] = {}

    # Dict from bot_id => botStatus
    bots: Dict[int, BotStatus] = {}

    # Dict from bot_id => activeMissionPlan
    active_mission_plans: Dict[int, MissionPlan] = {}

    # Dict from contact_id => contactUpdate
    contacts: Dict[int, ContactUpdate] = {}

    # Dict from bot_id => engineeringStatus
    bots_engineering: Dict[int, Engineering] = {}
    
    # Dict from hub_id => MetaData
    hub_metadata: Dict[int, DeviceMetadata] = {}

    # Task Packets
    task_packet_database = TaskPacketDatabase()

    # Path to the .taskpacket files
    task_packet_files_path = "/var/log/jaiabot/bot_offload"
    task_packet_loaded_filenames: Set[str] = set()

    controlling_client_id = "NONE"

    def __init__(self) -> None:
        pass


    def process_portal_to_client_message(self, hub_id, msg: PortalToClientMessage):
        if msg.HasField('bot_status'):
            msg.bot_status.received_time = utc_now_microseconds()
            self.bots[msg.bot_status.bot_id] = msg.bot_status

            if msg.HasField('active_mission_plan'):
                self.active_mission_plans[msg.bot_status.bot_id] = msg.active_mission_plan
            else:
                if msg.bot_status.bot_id in self.active_mission_plans:
                    del(self.active_mission_plans[msg.bot_status.bot_id])

        if msg.HasField('engineering_status'):
            self.bots_engineering[msg.engineering_status.bot_id] = msg.engineering_status

        if msg.HasField('contact_update'):
            self.contacts[msg.contact_update.contact] = msg.contact_update

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

def get_queue(hub_id=None):
    if hub_id:
        return to_portal_queue[hub_id]
    else:
        # return the first available queue if no hub_id is specified
        return to_portal_queue[list(to_portal_queue.keys())[0]]
