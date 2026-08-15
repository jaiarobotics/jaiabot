from common import is_simulation, is_runtime
from common import comms
import common

# Binding a UDP socket to port 0 allows the operating system to automatically assign an available port

def wifi_udp_port(node_id, hub_id = -1):
    if is_simulation():
        if node_id == comms.hub_node_id:
            if hub_id == -1:
                raise RuntimeError('Must define hub_id when node_id is hub_node_id')
            return 31000 + hub_id
        else:
            return 31000 + comms.number_of_hubs_max + node_id
    else:
        return 31000


def hub2hub_udp_port(hub_id):
    if is_simulation():
        return 32000 + hub_id
    else:
        return 32000
    

def udp_gateway_port(node_id):
    if is_simulation():
        return 20400 + node_id
    else:
        return 20000

def contact_gpsd_port(contact_id):
    return 33000 + contact_id

# in runtime this is fed by the SPI/I2C GPS driver, which defaults to the same
# port
def gpsd_udp_port(node_id):
    if is_simulation():
        return 32100 + node_id
    else:
        return 32100

def motor_cpp_udp_port():
    return 0

def motor_py_udp_port():
    return 20005 

def web_portal_udp_port(hub_id):
    if is_simulation() and common.jaia_sim_type == common.SimType.SINGLE_HOST:
        return 40001 - hub_id
    else:
        return 40000
