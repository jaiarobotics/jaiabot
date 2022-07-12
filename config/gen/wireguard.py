#!/usr/bin/env python3

import argparse
from enum import Enum
import os
from string import Template
import shutil
import subprocess

# defaults based on $PATH settings
script_dir=os.path.dirname(os.path.realpath(__file__))    

parser = argparse.ArgumentParser(description='Generate wireguard VPN configuration for JaiaBot and JaiaHub', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('type', choices=['bot', 'hub'], help='Should we generate VPN config for a bot or a hub?')
parser.add_argument('--name', default='wg_jaia', help='Name of the VPN to create.')
parser.add_argument('--bot_index', default=0, type=int, help='Bot index')
parser.add_argument('--hub_index', default=0, type=int, help='Hub index')
parser.add_argument('--fleet_index', default=0, type=int, help='Fleet index')
parser.add_argument('--enable', action='store_true', help='If set, run systemctl enable on the wg-quick service')
parser.add_argument('--disable', action='store_true', help='If set, run systemctl disable on the wg-quick service')
args=parser.parse_args()
 
macros=dict()

# only generate keys if none exist
privatekeyfilename='/etc/wireguard/privatekey'
publickeyfilename='/etc/wireguard/publickey'
if not os.path.exists(privatekeyfilename) or not os.path.exists(publickeyfilename):
    print("Missing private or public key, generating...")
    subprocess.run('bash -c "umask 077; wg genkey | tee ' + privatekeyfilename + ' | wg pubkey > ' + publickeyfilename + '"', check=True, shell=True)

privatekeyfile=open(privatekeyfilename, 'r')
macros['privatekey']=privatekeyfile.read()
    
# Address = 172.23.xxx.yyy
# xxx = fleet id
# yyy = 10 + hub_id or 100 + bot_id
if args.type == 'bot':
    macros['address'] = '172.23.' + str(args.fleet_index) + '.' + str(100+args.bot_index)
elif args.type == 'hub':
    macros['address'] = '172.23.' + str(args.fleet_index) + '.' + str(10+args.hub_index)
    
# AllowedIPs = 172.23.xxx.0/24
# xxx = fleet id
macros['subnet'] = '172.23.' + str(args.fleet_index) + '.0/24'

# Endpoint = vpn.jaia.tech:zzz
# zzz = 51821 + fleet_id
macros['vpnport'] = str(51821 + args.fleet_index)

with open(script_dir + '/../templates/etc/wg_jaia.conf.in', 'r') as file:        
    out=Template(file.read()).substitute(macros)    
    outfilename = '/etc/wireguard/' + args.name + '.conf'
    print('Writing ' + outfilename)
    outfile = open(outfilename, 'w')
    outfile.write(out)
    outfile.close()
    service = 'wg-quick@' + args.name
    if args.enable:
        print('Enabling ' + service)
        subprocess.run('systemctl enable ' + service, check=True, shell=True)
        subprocess.run('systemctl start ' + service, check=True, shell=True)
    if args.disable:
        print('Disabling ' + service)
        subprocess.run('systemctl stop ' + service, check=True, shell=True)
        subprocess.run('systemctl disable ' + service, check=True, shell=True)
        
if args.enable or args.disable:
    subprocess.run('systemctl daemon-reload', check=True, shell=True)
