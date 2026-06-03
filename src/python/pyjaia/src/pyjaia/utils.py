import socket
from typing import Dict
from datetime import datetime, timezone


def myip():
    """Gets the local machine's IP address.

    Returns:
        str: The local machine's IP address, or "localhost" if not found.
    """
    try:
        # Try to get IP addresses associated with the hostname
        hostname = socket.gethostname()
        ip_addresses = socket.gethostbyname_ex(hostname)[2]
        
        # Filter out localhost addresses (127.x.x.x)
        non_localhost_ips = [ip for ip in ip_addresses if not ip.startswith("127.")]
        
        if non_localhost_ips:
            return non_localhost_ips[0]
        
        # If no non-localhost IPs found, try connecting to external DNS to get local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            # Connect to Google DNS (doesn't actually send data)
            s.connect(("8.8.8.8", 53))
            local_ip = s.getsockname()[0]
            return local_ip
            
    except (socket.error, socket.gaierror, OSError, IndexError):
        return "localhost"
    

def now_utime():
    """Return the system time as Unix timestamp in microseconds.

    Returns:
        int: Unix timestamp in microseconds.
    """
    return int(datetime.now().timestamp() * 1e6)


def now_utime_sim_corrected(warp_factor=1, simulation_reference_time=0):
    """Return the system time as Unix timestamp in microseconds.
        In real-time operation, equivalent to previous now_utime() implementation.
        In simulation, time is warped from the reference time by the warp factor.
    Args:
        warp_factor (float, optional): A factor to warp the time by. Defaults to 1 (real time).
        simulation_reference_time (int, optional): The reference time for simulation. Defaults to 0.

    Returns:
        int: Unix timestamp in microseconds.
    """
    wall_clock_now_microseconds = int(datetime.now().timestamp() * 1e6)
    return int(simulation_reference_time + (wall_clock_now_microseconds - simulation_reference_time) * warp_factor)


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


