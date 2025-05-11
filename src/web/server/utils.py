from typing import *
from math import *


def get_task_packet_id(task_packet: Dict) -> str:
    """Returns an id string that uniquely identifies a task packet.

    Args:
        task_packet (Dict): The task packet in dict form.

    Returns:
        str: The unique id for this task packet.
    """

    # Combine the bot_id and start_time (rounded to the nearest second)
    bot_id = task_packet["bot_id"]
    SECOND = 1_000_000
    start_time = round(int(task_packet["start_time"]) / SECOND)

    return str(bot_id) + '_' + str(start_time)


if __name__ == '__main__':

    test = {
        'bot_id': 5,
        "start_time": "1746467099000000"
    }

    test2 = {
        'bot_id': 5,
        "start_time": "1746467098893455"
    }

    print(get_task_packet_id(test))
    print(get_task_packet_id(test2))

