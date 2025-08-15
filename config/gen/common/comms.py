from common import is_simulation, is_runtime
from common import udp
import common.bot
import netifaces
import math
import json

subnet_mask=0xFF00

subnet_index={'xbee': 0, 'wifi': 1, 'iridium': 2}
num_modems_in_subnet=(0xFFFF ^ subnet_mask)+1

# first id is hub id
hub_node_id=0

# same as jaiabot/src/lib/comms/comms.h
number_of_hubs_max=31
number_of_bots_max=151

all_local_ip_addresses = [netifaces.ifaddresses(iface)[netifaces.AF_INET][0]['addr'] for iface in netifaces.interfaces() if netifaces.AF_INET in netifaces.ifaddresses(iface)]

# Broadcast is modem id = 0 in Goby, so increment vehicle id by 1 to get base modem id
def base_modem_id(node_id):
    return node_id + 1

def modem_id(link, node_id):
    return base_modem_id(node_id) + subnet_index[link]*num_modems_in_subnet

def runtime_wifi_ip_addr(node_id, fleet_index, hub_id):
    if node_id == hub_node_id:
        return '10.23.' + str(fleet_index) + '.' + str(hub_id + 10)
    else:
        bot_id = node_id - 1
        return '10.23.' + str(fleet_index) + '.' + str(bot_id + 100)

def wifi_ip_addr(this_node_id, node_id, fleet_index, hub_id = -1):
    wifi_ip = runtime_wifi_ip_addr(node_id, fleet_index, hub_id)
    if is_simulation():
        # if this computer has an assigned IP address matching the expected runtime IP address, use the standard wifi IP addresses (VirtualBox fleet)
        
        if runtime_wifi_ip_addr(this_node_id, fleet_index, hub_id) in all_local_ip_addresses:
            return wifi_ip
        # otherwise use localhost (for standard single machine sim)
        else:
            return "127.0.0.1"
    else:
        return wifi_ip
    
def wifi_remotes(this_node_id, fleet_index, hub_id):
    remotes=''
    first_node_id=0
    
    for node_id in range(first_node_id, number_of_bots_max+first_node_id+1):
        if this_node_id != node_id:
            remotes+='remote { modem_id: ' + str(base_modem_id(node_id)) + ' ip: "' + wifi_ip_addr(this_node_id, node_id, fleet_index, hub_id)  + '" port: ' + str(udp.wifi_udp_port(node_id, hub_id)) + ' } \n'
    return remotes

def wifi_hub_remotes(this_node_id, fleet_index):
    hub_eps=''
    for hub_id in range(0, number_of_hubs_max):
        hub_eps+='hub_endpoint: { hub_id: ' + str(hub_id) + ' remote { modem_id: ' + str(base_modem_id(hub_node_id)) + ' ip: "' + wifi_ip_addr(this_node_id, hub_node_id, fleet_index, hub_id)  + '" port: ' + str(udp.wifi_udp_port(hub_node_id, hub_id)) + ' } }\n'
    return hub_eps

def wifi_mac_slots(node_id):
    slots = 'slot { src: ' + str(modem_id("wifi", node_id)) + ' slot_seconds: 0.1 max_frame_bytes: 250 }\n'
    return slots

def xbee_mac_slots(node_id):
    slots = 'slot { src: ' + str(modem_id("xbee", node_id)) + ' slot_seconds: 0.1 }\n'
    return slots

def iridium_mac_slots(node_id):
    # SBD is rate 0 in the Goby driver
    sbd_rate=0
    slots = 'slot { src: ' + str(modem_id("iridium", node_id)) + ' slot_seconds: 15 rate: ' + str(sbd_rate) + ' [goby.acomms.iridium.protobuf.transmission]: { if_no_data_do_mailbox_check: false } }\n'
    return slots

def iridium_shore_mac_slots(node_id):
    sbd_rate=0
    # no reason to really rate limit commands substantially
    slots = 'slot { src: ' + str(modem_id("iridium", node_id)) + ' slot_seconds: 5 rate: ' + str(sbd_rate) + ' }\n'
    return slots

def iridium_modem_imei_mapping():
    mapping=''
    if is_simulation():
        first_bot_node_id=1
        for node_id in range(first_bot_node_id, number_of_bots_max+first_bot_node_id):
            modem_id = base_modem_id(node_id)
            bot_id = node_id - 1
            mapping += 'modem_id_to_imei { modem_id: ' + str(modem_id) + ' imei: "' + f'{bot_id:015d}' + '" }\n'
        
    if is_runtime():
        with(open('/etc/jaiabot/iridium.json') as f):            
            j = json.load(f)
            for bot in j["bot"]:
                mapping += 'modem_id_to_imei { modem_id: ' + str(base_modem_id(bot["id"] + 1)) + ' imei: "' + bot["imei"] + '" }\n'
        
    return mapping

def iridium_sbd_type():
    if is_simulation():
        # RockBLOCK not yet supported
        return "SBD_DIRECTIP"

    if is_runtime():
        with(open('/etc/jaiabot/iridium.json') as f):            
            j = json.load(f)
            return j["sbdType"]

def iridium_rockblock_credentials():
    if is_simulation():
        # RockBLOCK not yet supported
        return ("user", "pass")

    if is_runtime():
        with(open('/etc/jaiabot/iridium.json') as f):            
            j = json.load(f)
            return (j["rockblock"]["username"], j["rockblock"]["password"])
