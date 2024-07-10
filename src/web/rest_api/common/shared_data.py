##
## Stores data shared between the Flask (main) thread and the streaming client thread
##

from queue import Queue
import threading
import logging


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
            #self.process_task_packet(packet)

        if msg.HasField('device_metadata'):
            self.metadata = msg.device_metadata


# Access must be locked!    
data = Data()
# protects Data
data_lock = threading.Lock()

# thread safe queue for outbound messages
to_portal_queue = Queue()
