from common import is_simulation
from common import comms

# Dictionary of base ports for each type
simulation_base_ports = {
    "wifi_udp": 31000, #we add the hub_id if it's a hub, else we add number_of_hubs_max + node_id
    "hub2hub_udp": 32000,#we add the hub_id
    "bar30_cpp": 20100,#we add the node_id
    "bar30_py": 20000,#we add the node_id
    "atlas_ezo_cpp": 20200,#we add the node_id
    "atlas_ezo_py": 20300,#we add the node_id
    "imu": 20400,#we add the node_id
    "contact_gpsd": 33000,#we add the contact_id
}

runtime_static_ports = {
    "wifi_udp": 31000,
    "hub2hub_udp": 32000,
    "bar30_cpp": 20100,
    "bar30_py": 20000,
    "atlas_ezo_cpp": 0,
    "atlas_ezo_py": 20002,
    "tsys01_cpp": 0,
    "tsys01_py": 20006,
    "motor_cpp": 0,
    "motor_py": 20005,
    "imu": 20000,
}


def wifi_udp_port(node_id, hub_id=-1):
    if is_simulation():
        if node_id == comms.hub_node_id:
            if hub_id == -1:
                raise RuntimeError("Must define hub_id when node_id is hub_node_id")
            return simulation_base_ports["wifi_udp"] + hub_id
        else:
            return simulation_base_ports["wifi_udp"] + comms.number_of_hubs_max + node_id
    else:
        return runtime_static_ports["wifi_udp"]

def hub2hub_udp_port(hub_id):
    return (simulation_base_ports["hub2hub_udp"] + hub_id) if is_simulation() else runtime_static_ports["hub2hub_udp"]

def bar30_cpp_udp_port(node_id):
    return (simulation_base_ports["bar30_cpp"] + node_id) if is_simulation() else runtime_static_ports["bar30_cpp"]

def bar30_py_udp_port(node_id):
    return (simulation_base_ports["bar30_py"] + node_id) if is_simulation() else runtime_static_ports["bar30_py"]

def tsys01_cpp_udp_port():
    return runtime_static_ports["tsys01_cpp"]

def tsys01_py_udp_port():
    return runtime_static_ports["tsys01_py"]

def atlas_ezo_cpp_udp_port(node_id):
    return (simulation_base_ports["atlas_ezo_cpp"] + node_id) if is_simulation() else runtime_static_ports["atlas_ezo_cpp"]

def atlas_ezo_py_udp_port(node_id):
    return (simulation_base_ports["atlas_ezo_py"] + node_id) if is_simulation() else runtime_static_ports["atlas_ezo_py"]

def imu_port(node_id):
    return (simulation_base_ports["imu"] + node_id) if is_simulation() else runtime_static_ports["imu"]

def contact_gpsd_port(contact_id):
    return simulation_base_ports["contact_gpsd"] + contact_id

def motor_cpp_udp_port():
    return runtime_static_ports["motor_cpp"]

def motor_py_udp_port():
    return runtime_static_ports["motor_py"]
