from common import is_simulation, is_runtime
import common.comms

def bot_index_to_vehicle_id(bot_index):
    return bot_index+common.comms.hub_vehicle_id+1

def simulator_port(vehicle_i):
    return 55000 + vehicle_id

def moos_port(vehicle_id):
    return 9000 + vehicle_id

def moos_simulator_port(vehicle_id):
    return 9100 + vehicle_id

def gpsd_device(vehicle_id):
    if is_simulation():
        return "udp://127.0.0.1:" + str(gpsd_simulator_udp_port(vehicle_id))
    else:
        return '/opt/jaiabot/dev/gps'

def gpsd_simulator_udp_port(vehicle_id):
    return 32000 + vehicle_id

def gpsd_port(vehicle_id):
    if is_simulation():
        return 32000 + vehicle_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port
