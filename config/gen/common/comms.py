from common import is_simulation, is_runtime
from common import udp
import common.bot
import netifaces
import math

subnet_mask=0xFF00

# currently we do not run the wifi and xbee in parallel so they can have the same subnet
subnet_index={'wifi': 0, 'xbee': 0}
num_modems_in_subnet=(0xFFFF ^ subnet_mask)+1

# first id is hub id
hub_node_id=0

# same as jaiabot/src/lib/comms/comms.h
number_of_bots_max=151

all_local_ip_addresses = [netifaces.ifaddresses(iface)[netifaces.AF_INET][0]['addr'] for iface in netifaces.interfaces() if netifaces.AF_INET in netifaces.ifaddresses(iface)]


# Broadcast is modem id = 0 in Goby, so increment vehicle id by 1 to get base modem id
def base_modem_id(node_id):
    return node_id + 1

def wifi_modem_id(node_id):
    return base_modem_id(node_id) + subnet_index['wifi']*num_modems_in_subnet

def xbee_modem_id(node_id):
    return base_modem_id(node_id) + subnet_index['xbee']*num_modems_in_subnet

def runtime_wifi_ip_addr(node_id, fleet_index):
    if node_id == hub_node_id:
        # TODO - support multiple hubs. For now, can only use VirtualFleet with hub1
        hub_index = 1
        return '10.23.' + str(fleet_index) + '.' + str(hub_index + 10)
    else:
        bot_index = node_id - 1
        return '10.23.' + str(fleet_index) + '.' + str(bot_index + 100)

def wifi_ip_addr(this_node_id, node_id, fleet_index):
    wifi_ip = runtime_wifi_ip_addr(node_id, fleet_index)
    if is_simulation():
        # if this computer has an assigned IP address matching the expected runtime IP address, use the standard wifi IP addresses (VirtualBox fleet)
        
        if runtime_wifi_ip_addr(this_node_id, fleet_index) in all_local_ip_addresses:
            return wifi_ip
        # otherwise use localhost (for standard single machine sim)
        else:
            return "127.0.0.1"
    else:
        return wifi_ip
    
def wifi_remotes(this_node_id, number_vehicles, fleet_index):
    remotes=''
    first_node_id=0
    for node_id in list(range(first_node_id, number_vehicles+first_node_id+1)):
        if this_node_id != node_id:
            remotes+='remote { modem_id: ' + str(base_modem_id(node_id)) + ' ip: "' + wifi_ip_addr(this_node_id, node_id, fleet_index)  + '" port: ' + str(udp.wifi_udp_port(node_id)) + ' } \n'
    return remotes

def wifi_mac_slots(node_id):
    slots = 'slot { src: ' + str(wifi_modem_id(node_id)) + ' slot_seconds: 0.1 max_frame_bytes: 250 }\n'
    return slots

def xbee_mac_slots(node_id):
    try:
        bot_id_count = 0

        with open('/etc/jaiabot/xbee.pb.cfg', 'r') as file:
            for line in file:
                # This is needed in case we have a comment in 
                # a xbee config file that has bot_id
                if '#' in line:
                    continue

                if 'bot_id' in line:
                    bot_id_count += 1

        # hubs can currently send commands that are 250 bytes
        hub_mac_cycle_time = 0.1
        # bots send bot status messages that are ~50 bytes
        bot_mac_cycle_time = 0.1
        # we found in testing that 4 bots sending bot status 
        # messages worked as expected
        max_bots_per_bin = 4

        total_bins = math.ceil(bot_id_count / max_bots_per_bin)

        bot_bin = node_id % total_bins

        slots = ''

        for bin in range(0, total_bins):
            slots += 'slot { src: ' + str(xbee_modem_id(0)) + ' slot_seconds: ' + str(hub_mac_cycle_time) + ' }\n'

            if bot_bin == bin and node_id != 0:
                slots += 'slot { src: ' + str(xbee_modem_id(node_id)) + ' slot_seconds: ' + str(bot_mac_cycle_time) + ' }\n'
            else:
                slots += 'slot { src: -1 slot_seconds: ' + str(bot_mac_cycle_time) + ' }\n' 
        
        return slots
    except FileNotFoundError:
        return ''


def xbee_config():
    try:
        return open('/etc/jaiabot/xbee.pb.cfg').read()
    except FileNotFoundError:
        return ''
    
