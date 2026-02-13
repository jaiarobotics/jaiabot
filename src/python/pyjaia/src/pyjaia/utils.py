import socket
from typing import Dict
from datetime import datetime, timezone


def myip():
    """Gets the local machine's IP address.

    Returns:
        str: The local machine's IP address, or "localhost" if not found.
    """
    try:
        return (([ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")] or [[(s.connect(("8.8.8.8", 53)), s.getsockname()[0], s.close()) for s in [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) + ["localhost"])[0]
    except Exception:
        return "localhost"


def now_utime():
    """Return the system time as Unix timestamp in microseconds.

    Returns:
        int: Unix timestamp in microseconds.
    """
    return int(datetime.now().timestamp() * 1e6)


def utime(d: datetime):
    """Return a UTC datetime as Unix timestamp in microseconds.

    Args:
        d (datetime): A UTC datetime.

    Returns:
        int: Unix timestamp in microseconds.
    """
    return int(d.replace(tzinfo=timezone.utc).timestamp() * 1e6)


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


