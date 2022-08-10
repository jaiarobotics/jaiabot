from common import is_simulation, is_runtime
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
    return 32000 + node_id

def gpsd_port(node_id):
    if is_simulation():
        return 32000 + node_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port
