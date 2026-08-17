from common import is_simulation
import common.comms
import common.udp

def bot_id_to_node_id(bot_id):
    return bot_id+common.comms.hub_node_id+1

def moos_port(node_id):
    return 9000 + node_id

def moos_simulator_port(node_id):
    return 9100 + node_id

def gpsd_device(node_id):
    return "udp://127.0.0.1:" + str(common.udp.gpsd_udp_port(node_id))

def gpsd_simulator_udp_port(node_id):
    return common.udp.gpsd_udp_port(node_id)

def gpsd_port(node_id):
    if is_simulation():
        return 32100 + node_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port

def serial_camera_port(bot_id: int):
    """Get the device path to the serial port connected to the Pi Zero device running the camera driver.

    Args:
        bot_id (int): The bot id.

    Returns:
        str: Path to the serial port, i.e. "/dev/ttyAMA5"
    """
    if is_simulation():
        return f"/tmp/bot{bot_id}_camera_0"
    else:
        return '/dev/ttyAMA5' # TODO: Change to /dev/rpicam when camera udev rules are updated