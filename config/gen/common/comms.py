from common import is_simulation, is_runtime
from common import udp

subnet_mask=0xFF00

# currently we do not run the wifi and xbee in parallel so they can have the same subnet
subnet_index={'wifi': 0, 'xbee': 0}
num_modems_in_subnet=(0xFFFF ^ subnet_mask)+1

# Broadcast is modem id = 0 in Goby, so increment vehicle id by 1 to get base modem id
def base_modem_id(vehicle_id):
    return vehicle_id + 1

def wifi_modem_id(vehicle_id):
    return base_modem_id(vehicle_id) + subnet_index['wifi']*num_modems_in_subnet

def xbee_modem_id(vehicle_id):
    return base_modem_id(vehicle_id) + subnet_index['xbee']*num_modems_in_subnet

def wifi_ip_addr(vehicle_id):
    if is_simulation():
        return "127.0.0.1"
    else:
        raise Exception("not implemented")
    
def wifi_remotes(this_vehicle_id, number_vehicles):
    remotes=''
    first_vehicle_id=0
    for vehicle_id in list(range(first_vehicle_id, number_vehicles+first_vehicle_id+1)):
        if this_vehicle_id != vehicle_id:
            remotes+='remote { modem_id: ' + str(base_modem_id(vehicle_id)) + ' ip: "' + wifi_ip_addr(vehicle_id)  + '" port: ' + str(udp.wifi_udp_port(vehicle_id)) + ' } \n'
    return remotes

# first id is hub id
hub_vehicle_id=0

def wifi_mac_slots(vehicle_id):
    slots = 'slot { src: ' + str(wifi_modem_id(vehicle_id)) + ' slot_seconds: 1 max_frame_bytes: 128 }\n'
    return slots

def xbee_mac_slots(vehicle_id):
    slots = 'slot { src: ' + str(xbee_modem_id(vehicle_id)) + ' slot_seconds: 1 max_frame_bytes: 200 }\n'
    return slots

