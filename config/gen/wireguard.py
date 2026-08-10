#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil
import subprocess

# defaults based on $PATH settings
script_dir=os.path.dirname(os.path.realpath(__file__))

def jaia_ip(args):
    """Run the standalone 'jaia_ip' tool (the implementation of 'jaia ip') with the given list of arguments and return the resulting address or network."""
    return subprocess.run(['jaia_ip'] + [str(a) for a in args], capture_output=True, text=True, check=True).stdout.strip()

parser = argparse.ArgumentParser(description='Generate wireguard VPN configuration for Jaia machines', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub', 'desktop'], help='Should we generate VPN config for a bot, hub or desktop?')
parser.add_argument('--name', default='wg_jaia', help='Name of the VPN to create.')
parser.add_argument('--bot_id', default=0, type=int, help='Bot ID')
parser.add_argument('--hub_id', default=0, type=int, help='Hub ID')
parser.add_argument('--desktop_ip', default=0, type=int, help='IP address for a computer')
parser.add_argument('--fleet_id', default=None, type=int, help='Fleet ID, or the main Jaia VPN if omitted')
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

macros=dict()

# only generate keys if none exist
privatekeyfilename=conf_path + '/privatekey'
publickeyfilename=conf_path + '/publickey'
if not os.path.exists(privatekeyfilename) or not os.path.exists(publickeyfilename):
    print(f"Missing private or public key at {conf_path}, generating...")
    subprocess.run('bash -c "umask 077; wg genkey | tee ' + privatekeyfilename + ' | wg pubkey > ' + publickeyfilename + '"', check=True, shell=True)

privatekeyfile=open(privatekeyfilename, 'r')
macros['privatekey']=privatekeyfile.read()

if args.fleet_id is None:
    # Legacy main Jaia VPN (not fleet-specific)
    ip_prefix = '172.20.11'
    if args.type == 'bot':
        macros['address'] = f'{ip_prefix}.{100 + args.bot_id}'
    elif args.type == 'hub':
        macros['address'] = f'{ip_prefix}.{10 + args.hub_id}'
    elif args.type == 'desktop':
        macros['address'] = f'{ip_prefix}.{args.desktop_ip}'
    macros['subnet'] = f'{ip_prefix}.0/24'
else:
    # Fleet-specific VPN: use 'jaia_ip' for addresses and the subnet
    macros['subnet'] = jaia_ip(['--query_type', 'net', '--ip_net', 'fleet_vpn', '--fleet_id', args.fleet_id, '--ip_version', 'ipv4'])
    if args.type == 'bot':
        macros['address'] = jaia_ip(['--query_type', 'addr', '--node_type', 'bot', '--ip_net', 'fleet_vpn', '--fleet_id', args.fleet_id, '--node_id', args.bot_id, '--ip_version', 'ipv4'])
    elif args.type == 'hub':
        macros['address'] = jaia_ip(['--query_type', 'addr', '--node_type', 'hub', '--ip_net', 'fleet_vpn', '--fleet_id', args.fleet_id, '--node_id', args.hub_id, '--ip_version', 'ipv4'])
    elif args.type == 'desktop':
        # 'jaia_ip' does not assign IPv4 addresses to desktops, so derive it from the fleet VPN subnet
        ip_prefix = macros['subnet'].split('/')[0].rsplit('.', 1)[0]
        macros['address'] = f'{ip_prefix}.{args.desktop_ip}'

# Endpoint = vpn.jaia.tech:zzz
# zzz = 51821 + fleet_id
if args.fleet_id is None:
    macros['vpnport'] = '51820'
else:
    macros['vpnport'] = str(51821 + args.fleet_id)

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
