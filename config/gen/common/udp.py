from common import is_simulation
from common import comms

# Dictionary of base ports for each type
simulation_base_ports = {
    # We add the node_id
    "bar30_py": 20000,
    # We add the node_id
    "bar30_cpp": 20100,
    # We add the node_id
    "atlas_ezo_cpp": 20200,
    # We add the node_id
    "atlas_ezo_py": 20300,
    # We add the node_id
    "imu_cpp": 20400,
    # We add the hub_id if it's a hub, else we add number_of_hubs_max + node_id
    "wifi_udp": 31000,
    # We add the hub_id
    "hub2hub_udp": 32000,
    # We add the contact_id
    "contact_gpsd": 33000
}


# Binding a UDP socket to port 0 allows the operating system to automatically assign an available port
runtime_static_ports = {
    "atlas_ezo_cpp": 0,
    "tsys01_cpp": 0,
    "motor_cpp": 0,
    "bar30_py": 20001,
    "atlas_ezo_py": 20002,
    "motor_py": 20005,
    "tsys01_py": 20006,
    "imu_cpp": 20007,
    "bar30_cpp": 20100,
    "wifi_udp": 31000,
    "hub2hub_udp": 32000,
    "contact_gpsd": 33000,
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
    return (simulation_base_ports["imu_cpp"] + node_id) if is_simulation() else runtime_static_ports["imu_cpp"]

def contact_gpsd_port(contact_id):
    return (simulation_base_ports["contact_gpsd"] + contact_id) if is_simulation() else runtime_static_ports["contact_gpsd"]

def motor_cpp_udp_port():
    return runtime_static_ports["motor_cpp"]

def motor_py_udp_port():
    return runtime_static_ports["motor_py"]
