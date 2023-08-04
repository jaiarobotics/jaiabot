from typing import *

import jaia_messages
import logging


def read_file(file_path: str) -> List[jaia_messages.TaskPacket]:
    try:
        with open(file_path) as file:
            return [jaia_messages.TaskPacket.from_json(task_packet_json) for task_packet_json in file]
    except Exception as e:
        logging.error(e)
