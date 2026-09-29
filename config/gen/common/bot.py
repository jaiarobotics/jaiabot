from common import is_simulation
import common.comms

def bot_index_to_node_id(bot_index):
    return bot_index+common.comms.hub_node_id+1

def moos_port(node_id):
    return 9000 + node_id

def moos_simulator_port(node_id):
    return 9100 + node_id

def gpsd_device(node_id):
    if is_simulation():
        return "udp://127.0.0.1:" + str(gpsd_simulator_udp_port(node_id))
    else:
        return '/dev/gps0'

def gpsd_simulator_udp_port(node_id):
    return 32100 + node_id

def gpsd_port(node_id):
    if is_simulation():
        return 32100 + node_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port

def serial_camera_port(bot_id: int, jaia_iridium_enabled: bool) -> str:
    """Get the device path to the serial port connected to the Pi Zero device running the camera driver.

    Args:
        bot_id (int): The bot id.
        jaia_iridium_enabled (bool): Whether Iridium is enabled on the bot.

    Returns:
        str: Path to the serial port, i.e. "/dev/ttyAMA5"
    """
    if is_simulation():
        return f"/tmp/bot{bot_id}_camera_0"

    if jaia_iridium_enabled:
        return '/dev/ttyAMA3'
    else:
        return '/dev/ttyAMA5'