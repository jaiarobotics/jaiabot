from common import is_simulation, is_runtime
from common import udp
from common.hub import expected_hubs_from_inventory
import common.bot
import netifaces
import math
import json
import subprocess
import pathlib

subnet_mask=0xFF00

subnet_index={'xbee': 0, 'wifi': 1, 'iridium': 2, 'hub2hub': 3}
num_modems_in_subnet=(0xFFFF ^ subnet_mask)+1

# first id is hub id
hub_node_id=0

# same as jaiabot/src/lib/comms/comms.h
number_of_hubs_max=31
number_of_bots_max=151

default_hub_id=1

# Broadcast is modem id = 0 in Goby, so increment vehicle id by 1 to get base modem id
def base_modem_id(node_id):
    return node_id + 1

def modem_id(link, node_id):
    if link == 'hub2hub':
        raise ValueError("Must use hub2hub_modem_id function for 'hub2hub' link")
    return base_modem_id(node_id) + subnet_index[link]*num_modems_in_subnet

########
# XBee #
########

def xbee_mac_slots(node_id):
    slots = 'slot { src: ' + str(modem_id("xbee", node_id)) + ' slot_seconds: 0.1 }\n'
    return slots

########
# Wifi #
########

all_local_ip_addresses = [netifaces.ifaddresses(iface)[netifaces.AF_INET][0]['addr'] for iface in netifaces.interfaces() if netifaces.AF_INET in netifaces.ifaddresses(iface)]

def jaia_ip(args):
    """Run the standalone 'jaia_ip' tool (the implementation of 'jaia ip') with the given list of arguments and return the resulting address or network."""
    return subprocess.run(['jaia_ip'] + [str(a) for a in args], capture_output=True, text=True, check=True).stdout.strip()

def runtime_wifi_ip_addr(node_id, fleet_index, hub_id):
    if node_id == hub_node_id:
        return jaia_ip(['--query_type', 'addr', '--node_type', 'hub', '--ip_net', 'wlan', '--fleet_id', fleet_index, '--node_id', hub_id, '--ip_version', 'ipv4'])
    else:
        bot_id = node_id - 1
        return jaia_ip(['--query_type', 'addr', '--node_type', 'bot', '--ip_net', 'wlan', '--fleet_id', fleet_index, '--node_id', bot_id, '--ip_version', 'ipv4'])

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
        # skip self and hub, we'll add the hub in later with wifi_hub_remotes
        if this_node_id != node_id and node_id != hub_node_id:
            remotes+='remote { modem_id: ' + str(base_modem_id(node_id)) + ' ip: "' + wifi_ip_addr(this_node_id, node_id, fleet_index, hub_id)  + '" port: ' + str(udp.wifi_udp_port(node_id, hub_id)) + ' } \n'
    return remotes

def wifi_hub_remotes(this_node_id, fleet_index):
    hub_eps=''
    broadcast_modem_id=0
    for hub_id in expected_hubs_from_inventory():
        # use broadcast ID so that UDP driver will transmit to all hubs in use
        hub_eps+='# hub ' + str(hub_id) + '\nremote { modem_id: ' + str(broadcast_modem_id) + ' ip: "' + wifi_ip_addr(this_node_id, hub_node_id, fleet_index, hub_id)  + '" port: ' + str(udp.wifi_udp_port(hub_node_id, hub_id)) + ' }\n'
    return hub_eps

def wifi_mac_slots(node_id):
    slots = 'slot { src: ' + str(modem_id("wifi", node_id)) + ' slot_seconds: 0.1 max_frame_bytes: 250 }\n'
    return slots

###########
# Iridium #
###########

iridium_json=pathlib.Path('/etc/jaiabot/iridium.json')

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
        with(open(iridium_json) as f):            
            j = json.load(f)
            for bot in j["bot"]:
                mapping += 'modem_id_to_imei { modem_id: ' + str(base_modem_id(bot["id"] + 1)) + ' imei: "' + bot["imei"] + '" }\n'
        
    return mapping

def iridium_sbd_type():
    if is_simulation():
        # RockBLOCK not yet supported
        return "SBD_DIRECTIP"

    if is_runtime():
        # If the hub doesn't have /etc/jaiabot/iridium.json, gracefully
        # do not configure Iridium
        if not iridium_json.exists():
            return None
        
        with(open(iridium_json) as f):            
            j = json.load(f)
            return j["sbdType"]

def iridium_rockblock_credentials():
    if is_simulation():
        # RockBLOCK not yet supported
        return ("user", "pass")

    if is_runtime():
        with(open(iridium_json) as f):            
            j = json.load(f)
            return (j["rockblock"]["username"], j["rockblock"]["password"])

        
###########
# Hub2Hub #
###########

# Still allow hub_id = 0, so increment by 1 to avoid Goby Broadcast ID
def hub2hub_modem_id(hub_id):
    return hub_id + 1 + subnet_index['hub2hub']*num_modems_in_subnet

def runtime_hub2hub_ip_addr(hub_id, fleet_index):
    return jaia_ip(['--query_type', 'addr', '--node_type', 'hub', '--ip_net', 'cloudhub_vpn', '--fleet_id', fleet_index, '--node_id', hub_id, '--ip_version', 'ipv6'])

def has_cloudhub_vpn(fleet_index):
    cloudhub_vpn_iface=[f'wg_jaia_ch{fleet_index}', 'wg_cloudhub']
    all_interfaces=netifaces.interfaces()
    for iface in cloudhub_vpn_iface:
        if iface in all_interfaces:
            return True
    return False

def hub2hub_ip_addr(this_hub_id, hub_id, fleet_index):
    hub2hub_ip = runtime_hub2hub_ip_addr(hub_id, fleet_index)
    if is_simulation():
        # use localhost (for standard single machine sim)
        return "::1"
    else:
        return hub2hub_ip
    
def hub2hub_remotes(this_hub_id, fleet_index):
    remotes=''
    first_hub_id=0
    
    for hub_id in range(first_hub_id, number_of_hubs_max):
        if this_hub_id != hub_id:
            remotes+='remote { modem_id: ' + str(hub_id + 1) + ' ip: "' + hub2hub_ip_addr(this_hub_id, hub_id, fleet_index)  + '" port: ' + str(udp.hub2hub_udp_port(hub_id)) + ' } \n'
    return remotes

def hub2hub_mac_slots(hub_id):
    slots = 'slot { src: ' + str(hub2hub_modem_id(hub_id)) + ' slot_seconds: 0.1 max_frame_bytes: 1000 }\n'
    return slots
