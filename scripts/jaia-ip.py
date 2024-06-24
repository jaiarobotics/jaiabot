#!/usr/bin/env python3

import argparse
import sys
import ipaddress

parser = argparse.ArgumentParser(description='Generate IP address for Jaia systems', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['addr', 'net'], help='Return type (addr is full address for a node, net is the network with subnet mask)')
parser.add_argument('--node', choices=['bot', 'hub', 'desktop'], help='Type of system')
parser.add_argument('--net',  required=True, choices=['wlan', 'fleet_vpn', 'vfleet_vpn', 'cloudhub_vpn', 'cloudhub_eth', 'vfleet_eth', 'vfleet_wlan', 'vpc'], help='Type of network')
parser.add_argument('--fleet_id', required=True, type=int, help='Fleet id')
parser.add_argument('--node_id',  default=0, type=int, help='Bot, hub, or desktop index')
ipv_group = parser.add_mutually_exclusive_group(required=True)
ipv_group.add_argument('--ipv4', action='store_true', help='IPv4')
ipv_group.add_argument('--ipv6', action='store_true', help='IPv6')
parser.add_argument('--ipv6_base', default=None, help='Prefix for determining IPv6 addresses for cloud eth/wlan networks')
args=parser.parse_args()

fleet_id_min=0
fleet_id_max=255

if not args.fleet_id in range(fleet_id_min, fleet_id_max+1):
    print(f"fleet_id for {args.fleet_id} is not in range: {fleet_id_min} to {fleet_id_max}", file=sys.stderr)
    exit(1)


ipv4_base=dict()
ipv4_base['wlan']=ipaddress.ip_address(f'10.23.{args.fleet_id}.0')
ipv4_base['fleet_vpn']=ipaddress.ip_address(f'172.23.{args.fleet_id}.0')
ipv4_base['cloudhub_eth']=ipaddress.ip_address(f'10.23.255.0')
ipv4_base['vfleet_eth']=ipaddress.ip_address(f'10.23.254.0')
ipv4_base['vfleet_wlan']=ipv4_base['wlan']
ipv4_base['vpc']=ipaddress.ip_address(f'10.23.0.0')

ipv4_mask=dict()
ipv4_mask['wlan']=24
ipv4_mask['fleet_vpn']=24
ipv4_mask['cloudhub_eth']=24
ipv4_mask['vfleet_eth']=24
ipv4_mask['vfleet_wlan']=ipv4_mask['wlan']
ipv4_mask['vpc']=16

ipv6_base=dict()
ipv6_base['wlan']=ipaddress.ip_address(f'fddd:7f2e:3258:{args.fleet_id:x}::')
ipv6_base['fleet_vpn']=ipaddress.ip_address(f'fd91:5457:1e5c:{args.fleet_id:x}::')
ipv6_base['vfleet_vpn']=ipaddress.ip_address(f'fd6e:cf0d:aefa:{args.fleet_id:x}::')
ipv6_base['cloudhub_vpn']=ipaddress.ip_address(f'fd0f:77ac:4fdf:{args.fleet_id:x}::')

ipv6_mask=dict()
ipv6_mask['wlan']=64
ipv6_mask['fleet_vpn']=64
ipv6_mask['cloudhub_vpn']=64
ipv6_mask['vfleet_vpn']=64
ipv6_mask['cloudhub_eth']=64
ipv6_mask['vfleet_eth']=64
ipv6_mask['vfleet_wlan']=ipv6_mask['wlan']

# limited by IPv4 addresses and definitions in jaiabot/src/lib/comms/comms.h
id={ 'min': { 'bot': 0, 'hub': 0, 'desktop': 1 },
     'max': { 'bot': 150, 'hub': 30, 'desktop': 9}
}

if args.node_id and not args.node_id in range(id['min'][args.node], id['max'][args.node]+1):
    print(f"node_id for {args.node_id} is not in range: {id['min'][args.node]} to {id['max'][args.node]}", file=sys.stderr)
    exit(1)

if args.type =='addr' and (not args.node or not args.node_id):
    print(f'Must define --node and --node_id for "addr"',file=sys.stderr)
    exit(1)

if args.ipv4:
    try:
        if args.type == 'addr':
            ipv4 = ipv4_base[args.net] + args.node_id
            if args.node == 'hub':
                ipv4 += 10
            elif args.node == 'bot':
                ipv4 += 100
            print(ipv4)
        elif args.type == 'net':
            ipv4_net = ipaddress.ip_network(str(ipv4_base[args.net]) + '/' + str(ipv4_mask[args.net]))
            print(ipv4_net)    
    except:
        print(f'ipv4 {args.type} failed for net "{args.net}" and node "{args.node}"', file=sys.stderr)
        raise
        exit(1)
elif args.ipv6:
    try:
        if args.net in { 'cloudhub_eth', 'vfleet_eth', 'vfleet_wlan' }:
            if args.ipv6_base == None:
                print(f'Must define --ipv6_base for for net "{args.net}"',file=sys.stderr)
                exit(1)
            try:
                ipv6 = ipaddress.ip_address(args.ipv6_base)
            except ValueError:
                ipv6 = ipaddress.ip_network(args.ipv6_base)[0]

            if args.net == 'cloudhub_eth':
                ipv6 += 0*2**64
            elif args.net == 'vfleet_eth':
                ipv6 += 1*2**64
            elif args.net == 'vfleet_wlan':
                ipv6 += 2*2**64
        else:
            ipv6 = ipv6_base[args.net]

        if args.type == 'addr':
            ipv6 += args.node_id
            if args.node == 'hub':
                ipv6 += 0*2**16 
            elif args.node == 'bot':
                ipv6 += 1*2**16 
            elif args.node == 'desktop':
                ipv6 += 2*2**16             
            print(ipv6)
        elif args.type == 'net':
            ipv6_net = ipaddress.ip_network(str(ipv6) + '/' + str(ipv6_mask[args.net]), strict=False)
            print(ipv6_net)
            
    except:
        print(f'ipv6 {args.type} failed for net "{args.net}" and node "{args.node}"', file=sys.stderr)
        raise
        exit(1)
