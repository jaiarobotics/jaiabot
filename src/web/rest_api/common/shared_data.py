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
from common.crudl_records import CRUDLRecords
from pathlib import Path
import os

# Messages
from jaiabot.messages.hub_pb2 import HubStatus
from jaiabot.messages.jaia_dccl_pb2 import BotStatus, ContactUpdate
from jaiabot.messages.mission_pb2 import MissionPlan
from jaiabot.messages.engineering_pb2 import Engineering
from jaiabot.messages.metadata_pb2 import DeviceMetadata
from jaiabot.messages.portal_pb2 import PortalToClientMessage

# Respect jaia_log_dir so simulation and runtime each store in their own directory.
_LOG_DIR = Path(os.environ.get('jaia_log_dir', '/var/log/jaiabot'))

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

    # Dict from hub_id => label of the streaming endpoint its status last arrived on.
    # A portal also reports the hubs it hears over hub-to-hub, so several hubs can share one.
    hub_endpoints: Dict[int, int] = {}

    # Dict from hub_id => label of the streaming endpoint whose portal runs on that hub
    portal_endpoints: Dict[int, int] = {}

    # Task Packets
    task_packet_database = TaskPacketDatabase()

    # Path to the .taskpacket files
    task_packet_files_path = "/var/log/jaiabot/bot_offload"
    task_packet_loaded_filenames: Set[str] = set()

    # The operator client that last took control; None until one does
    controlling_client_id: Optional[str] = None

    exclusion_zones = CRUDLRecords(_LOG_DIR / 'exclusion-zones')
    mission_sets = CRUDLRecords(_LOG_DIR / 'mission-sets')

    def __init__(self) -> None:
        pass


    def process_portal_to_client_message(self, endpoint, msg: PortalToClientMessage):
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
            self.hub_endpoints[msg.hub_status.hub_id] = endpoint

            # Task packets that weren't sent over the radio arrive in files from the offload
            if msg.hub_status.bot_offload.offload_succeeded:
                self.task_packet_database.add_task_packets_from_files()
            
        if msg.HasField('task_packet'):
            log.info('Task packet received')
            packet = msg.task_packet
            self.task_packet_database.add_task_packet(MessageToDict(packet, preserving_proto_field_name=True))

        if msg.HasField('device_metadata'):
            # The endpoint's label is only a guess at its hub's ID when no config names it
            hub_id = msg.device_metadata.hub_id if msg.device_metadata.HasField('hub_id') else endpoint
            self.hub_metadata[hub_id] = msg.device_metadata
            self.portal_endpoints[hub_id] = endpoint

    def endpoints_for_hubs(self, hub_ids) -> Set[int]:
        """The streaming endpoints that reach these hubs, so a command goes once through each portal."""
        return {self.hub_endpoints[hub_id] for hub_id in hub_ids if hub_id in self.hub_endpoints}


# Access must be locked!    
data = Data()
# protects Data
data_lock = threading.Lock()

to_portal_queue = dict()
def create_queues(streaming_endpoints):
    for ep in streaming_endpoints:
        # thread safe queue for outbound messages
        to_portal_queue[ep.hub_id] = Queue()

def get_queue(endpoint):
    return to_portal_queue[endpoint]
