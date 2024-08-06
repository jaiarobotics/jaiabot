from common import is_simulation, is_runtime
from common import comms

def wifi_udp_port(node_id):
    return 31000 + comms.wifi_modem_id(node_id)

def bar30_cpp_udp_port(node_id):
    if is_simulation():
        return 20100 + node_id
    else:
        return 0
    
def bar30_py_udp_port(node_id):
    if is_simulation():
        return 20000 + node_id
    else:
        return 20001
    
def tsys01_cpp_udp_port():
    return 0

def tsys01_py_udp_port():
    return 20005 

def atlas_ezo_cpp_udp_port(node_id):
    if is_simulation():
        return 20200 + node_id
    else:
        return 0
    
def atlas_ezo_py_udp_port(node_id):
    if is_simulation():
        return 20300 + node_id
    else:
        return 20002
    
def imu_port(node_id):
    if is_simulation():
        return 20400 + node_id
    else:
        return 20000
