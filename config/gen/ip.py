#!/usr/bin/env python3

import argparse
import sys
import ipaddress

parser = argparse.ArgumentParser(description='Generate IP address for Jaia systems', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--node', required=True, choices=['bot', 'hub', 'desktop'], help='Type of system')
parser.add_argument('--net',  required=True, choices=['wlan', 'fleet_vpn', 'vfleet_vpn', 'cloudhub_vpn', 'cloudhub_eth', 'vfleet_eth', 'vfleet_wlan'], help='Type of network')
parser.add_argument('--fleet_index', required=True, type=int, help='Fleet index')
parser.add_argument('--node_id',  required=True, default=0, type=int, help='Bot, hub, or desktop index')
parser.add_argument('--ip_version', choices=[4,6], default=4, type=int, help='IP address version (4 or 6)')
parser.add_argument('--ipv6_base', default=None, help='Prefix for determining IPv6 addresses for cloud eth/wlan networks')
args=parser.parse_args()

ipv4_base=dict()
ipv4_base['wlan']=ipaddress.ip_address(f'10.23.{args.fleet_index}.0')
ipv4_base['fleet_vpn']=ipaddress.ip_address(f'172.23.{args.fleet_index}.0')
ipv4_base['cloudhub_eth']=ipaddress.ip_address(f'10.23.255.0')
ipv4_base['vfleet_eth']=ipaddress.ip_address(f'10.23.254.0')
ipv4_base['vfleet_wlan']=ipv4_base['wlan']

ipv6_base=dict()
ipv6_base['wlan']=ipaddress.ip_address(f'fddd:7f2e:3258:{args.fleet_index}::')
ipv6_base['fleet_vpn']=ipaddress.ip_address(f'fd91:5457:1e5c:{args.fleet_index}::')
ipv6_base['vfleet_vpn']=ipaddress.ip_address(f'fd6e:cf0d:aefa:{args.fleet_index}::')
ipv6_base['cloudhub_vpn']=ipaddress.ip_address(f'fd0f:77ac:4fdf:{args.fleet_index}::')

# limited by IPv4 addresses and definitions in jaiabot/src/lib/comms/comms.h
id={ 'min': { 'bot': 0, 'hub': 0, 'desktop': 1 },
     'max': { 'bot': 150, 'hub': 30, 'desktop': 9}
}

if not args.node_id in range(id['min'][args.node], id['max'][args.node]+1):
    print(f"node_id for {args.node_id} is not in range: {id['min'][args.node]} to {id['max'][args.node]}", file=sys.stderr)
    exit(1)

if args.ip_version == 4:
    try:
        ipv4 = ipv4_base[args.net] + args.node_id
        if args.node == 'hub':
            ipv4 += 10
        elif args.node == 'bot':
            ipv4 += 100
        print(ipv4)
    except:
        print(f'ipv4 address not defined for net "{args.net}" and node "{args.node}"', file=sys.stderr)
        exit(1)
elif args.ip_version == 6:
    try:
        if args.net in { 'cloudhub_eth', 'vfleet_eth', 'vfleet_wlan' }:
            if args.ipv6_base == None:
                print(f'Must define --ipv6_base for for net "{args.net}"',file=sys.stderr)
                exit(1)
            ipv6 = ipaddress.ip_address(args.ipv6_base)
        else:
            ipv6 = ipv6_base[args.net]

        ipv6 += args.node_id
        if args.node == 'hub':
            ipv6 += 0*2**16 
        elif args.node == 'bot':
            ipv6 += 1*2**16 
        elif args.node == 'desktop':
            ipv6 += 2*2**16             
        print(ipv6)            
    except:
        print(f'ipv6 address not defined for net "{args.net}" and node "{args.node}"', file=sys.stderr)
        raise
        exit(1)
