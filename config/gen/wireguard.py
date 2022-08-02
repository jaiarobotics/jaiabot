#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil
import subprocess

# defaults based on $PATH settings
script_dir=os.path.dirname(os.path.realpath(__file__))    

parser = argparse.ArgumentParser(description='Generate wireguard VPN configuration for Jaia machines', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub', 'desktop'], help='Should we generate VPN config for a bot, hub or desktop?')
parser.add_argument('--name', default='wg_jaia', help='Name of the VPN to create.')
parser.add_argument('--bot_index', default=0, type=int, help='Bot index')
parser.add_argument('--hub_index', default=0, type=int, help='Hub index')
parser.add_argument('--desktop_ip', default=0, type=int, help='IP address for a computer')
parser.add_argument('--fleet_index', default=None, type=int, help='Fleet index, or the main Jaia VPN if omitted')
parser.add_argument('--enable', action='store_true', help='If set, run systemctl enable on the wg-quick service')
parser.add_argument('--disable', action='store_true', help='If set, run systemctl disable on the wg-quick service')
args=parser.parse_args()

# Find the conf_path
conf_paths = ['/etc/wireguard', '/usr/local/etc/wireguard']

conf_path = None
for path in conf_paths:
    if os.path.isdir(path):
        conf_path = path
        break

if conf_path is None:
    print(f'Cannot find wireguard conf directory in: {conf_paths}')
    exit(1)
else:
    print(f'Found wireguard conf path: {conf_path}')

# Get the ip_prefix
if args.fleet_index is None:
    ip_prefix = '172.20.11'
else:
    ip_prefix = f'172.23.{args.fleet_index}'

macros=dict()

# only generate keys if none exist
privatekeyfilename=conf_path + '/privatekey'
publickeyfilename=conf_path + '/publickey'
if not os.path.exists(privatekeyfilename) or not os.path.exists(publickeyfilename):
    print(f"Missing private or public key at {conf_path}, generating...")
    subprocess.run('bash -c "umask 077; wg genkey | tee ' + privatekeyfilename + ' | wg pubkey > ' + publickeyfilename + '"', check=True, shell=True)

privatekeyfile=open(privatekeyfilename, 'r')
macros['privatekey']=privatekeyfile.read()
    
# Address = 172.23.xxx.yyy
# xxx = fleet id
# yyy = 10 + hub_id or 100 + bot_id
if args.type == 'bot':
    macros['address'] = f'{ip_prefix}.{100 + args.bot_index}'
elif args.type == 'hub':
    macros['address'] = f'{ip_prefix}.{10 + args.hub_index}'
elif args.type == 'desktop':
    macros['address'] =  f'{ip_prefix}.{args.desktop_ip}'
    
# AllowedIPs = 172.23.xxx.0/24
# xxx = fleet id
macros['subnet'] =  f'{ip_prefix}.0/24'

# Endpoint = vpn.jaia.tech:zzz
# zzz = 51821 + fleet_id
if args.fleet_index is None:
    macros['vpnport'] = '51820'
else:
    macros['vpnport'] = str(51821 + args.fleet_index)

with open(script_dir + '/../templates/etc/wg_jaia.conf.in', 'r') as file:        
    out=Template(file.read()).substitute(macros)    
    outfilename = f'{conf_path}/{args.name}.conf'
    print('Writing ' + outfilename)
    outfile = open(outfilename, 'w')
    outfile.write(out)
    outfile.close()
    service = 'wg-quick@' + args.name
    if args.enable:
        print('Enabling ' + service)
        subprocess.run('systemctl enable ' + service, check=True, shell=True)
        subprocess.run('systemctl restart ' + service, check=True, shell=True)
    if args.disable:
        print('Disabling ' + service)
        subprocess.run('systemctl stop ' + service, check=True, shell=True)
        subprocess.run('systemctl disable ' + service, check=True, shell=True)
        
if args.enable or args.disable:
    subprocess.run('systemctl daemon-reload', check=True, shell=True)
