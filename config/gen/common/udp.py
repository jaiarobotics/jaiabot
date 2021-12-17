from common import is_simulation, is_runtime
from common import comms

def wifi_udp_port(vehicle_id):
    return 31000 + comms.wifi_modem_id(vehicle_id)

def bar30_cpp_udp_port(vehicle_id):
    if is_simulation():
        return 20100 + vehicle_id
    else:
        return 0
    
def bar30_py_udp_port(vehicle_id):
    if is_simulation():
        return 20000 + vehicle_id
    else:
        return 20001
