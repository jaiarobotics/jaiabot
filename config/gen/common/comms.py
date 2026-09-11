from common import is_simulation, is_runtime
from common import udp
from common.hub import expected_hubs_from_inventory
import common
import common.bot
import netifaces
import functools
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

# the scope suffix netifaces puts on link-local IPv6 addresses ("fe80::1%wlan0") is not part of
# the address 'jaia_ip' reports
all_local_ip_addresses = [addr['addr'].split('%')[0]
                          for iface in netifaces.interfaces()
                          for family in (netifaces.AF_INET, netifaces.AF_INET6)
                          for addr in netifaces.ifaddresses(iface).get(family, [])]

def jaia_ip(args):
    """Run the standalone 'jaia_ip' tool (the implementation of 'jaia ip') with the given list of arguments and return the resulting address or network."""
    return subprocess.run(['jaia_ip'] + [str(a) for a in args], capture_output=True, text=True, check=True).stdout.strip()

def wifi_net():
    """The network a WIFI link is addressed on. A VirtualFleet node is an EC2 instance on its VPC's
    subnet rather than on a fleet WLAN; for a fleet whose id fits the IPv4 octet the two are the
    same addresses, and above that they are not (see vfleet_wlan_ipv4_octet in ip.h)."""
    return 'vfleet_wlan' if common.is_vfleet else 'wlan'

@functools.lru_cache(maxsize=None)
def wifi_is_ipv6(fleet_id):
    """Whether the WIFI link is addressed with IPv6, taken from the network 'jaia_ip' gives for it rather than from the fleet id, since the two WIFI networks do not answer alike."""
    return ':' in jaia_ip(['--query_type', 'net', '--ip_net', wifi_net(), '--fleet_id', fleet_id])

def wifi_link_ipv6(fleet_id):
    """The 'ipv6' field of the WIFI link's UDP driver."""
    return 'ipv6: true' if wifi_is_ipv6(fleet_id) else ''

def localhost_addr(fleet_id):
    return '::1' if wifi_is_ipv6(fleet_id) else '127.0.0.1'

def runtime_wifi_ip_addr(node_id, fleet_id, hub_id):
    if node_id == hub_node_id:
        return jaia_ip(['--query_type', 'addr', '--node_type', 'hub', '--ip_net', wifi_net(), '--fleet_id', fleet_id, '--node_id', hub_id])
    else:
        bot_id = node_id - 1
        return jaia_ip(['--query_type', 'addr', '--node_type', 'bot', '--ip_net', wifi_net(), '--fleet_id', fleet_id, '--node_id', bot_id])

def wifi_ip_addr(this_node_id, node_id, fleet_id, hub_id = -1):
    wifi_ip = runtime_wifi_ip_addr(node_id, fleet_id, hub_id)
    if is_simulation():
        # if this computer has an assigned IP address matching the expected runtime IP address, use the standard wifi IP addresses (VirtualBox fleet)
        if runtime_wifi_ip_addr(this_node_id, fleet_id, hub_id) in all_local_ip_addresses:
            return wifi_ip
        # otherwise use localhost (for standard single machine sim)
        else:
            return localhost_addr(fleet_id)
    else:
        return wifi_ip

def wifi_remotes(this_node_id, fleet_id, hub_id):
    remotes=''
    first_node_id=0
    
    for node_id in range(first_node_id, number_of_bots_max+first_node_id+1):
        # skip self and hub, we'll add the hub in later with wifi_hub_remotes
        if this_node_id != node_id and node_id != hub_node_id:
            remotes+='remote { modem_id: ' + str(base_modem_id(node_id)) + ' ip: "' + wifi_ip_addr(this_node_id, node_id, fleet_id, hub_id)  + '" port: ' + str(udp.wifi_udp_port(node_id, hub_id)) + ' } \n'
    return remotes

def wifi_hub_remotes(this_node_id, fleet_id):
    hub_eps=''
    broadcast_modem_id=0
    for hub_id in expected_hubs_from_inventory():
        # use broadcast ID so that UDP driver will transmit to all hubs in use
        hub_eps+='# hub ' + str(hub_id) + '\nremote { modem_id: ' + str(broadcast_modem_id) + ' ip: "' + wifi_ip_addr(this_node_id, hub_node_id, fleet_id, hub_id)  + '" port: ' + str(udp.wifi_udp_port(hub_node_id, hub_id)) + ' }\n'
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

def runtime_hub2hub_ip_addr(hub_id, fleet_id):
    return jaia_ip(['--query_type', 'addr', '--node_type', 'hub', '--ip_net', 'cloudhub_vpn', '--fleet_id', fleet_id, '--node_id', hub_id, '--ip_version', 'ipv6'])

def has_cloudhub_vpn(fleet_id):
    cloudhub_vpn_iface=[f'wg_jaia_ch{fleet_id}', 'wg_cloudhub']
    all_interfaces=netifaces.interfaces()
    for iface in cloudhub_vpn_iface:
        if iface in all_interfaces:
            return True
    return False

def hub2hub_ip_addr(this_hub_id, hub_id, fleet_id):
    hub2hub_ip = runtime_hub2hub_ip_addr(hub_id, fleet_id)
    if is_simulation():
        # use localhost (for standard single machine sim)
        return "::1"
    else:
        return hub2hub_ip
    
def hub2hub_remotes(this_hub_id, fleet_id):
    remotes=''
    first_hub_id=0
    
    for hub_id in range(first_hub_id, number_of_hubs_max):
        if this_hub_id != hub_id:
            remotes+='remote { modem_id: ' + str(hub_id + 1) + ' ip: "' + hub2hub_ip_addr(this_hub_id, hub_id, fleet_id)  + '" port: ' + str(udp.hub2hub_udp_port(hub_id)) + ' } \n'
    return remotes

def hub2hub_mac_slots(hub_id):
    slots = 'slot { src: ' + str(hub2hub_modem_id(hub_id)) + ' slot_seconds: 0.1 max_frame_bytes: 1000 }\n'
    return slots
