#!/usr/bin/env python3

import sys
import os

# A bit hacky, but we need to do this until we properly install pyjaiaprotobu
def set_pythonpath():
    script_path = os.path.abspath(__file__)
    script_dir = os.path.dirname(script_path)
    python_path = os.path.join(script_dir, "../share/jaiabot/python/pyjaiaprotobuf")

    # Resolve to an absolute path and add to sys.path if valid
    if python_path:
        python_path = os.path.abspath(python_path)
        if os.path.exists(python_path):
            sys.path.insert(0, python_path)
        else:
            print(f"Warning: {python_path} does not exist")
            sys.exit(1)

set_pythonpath()

import jinja2
import json
from google.protobuf import text_format, json_format
from jaiabot.messages.fleet_config_pb2 import FleetConfig
import argparse
import subprocess


def read_fleet_from_textproto(file_path):
    fleet_cfg = FleetConfig()
    with open(file_path, "r") as f:
        text_format.Parse(f.read(), fleet_cfg)
    return json.loads(json_format.MessageToJson(fleet_cfg))

def render_template(template_path, context):
    with open(template_path, "r") as f:
        template = jinja2.Template(f.read())
    return template.render(context)


def merge_overrides(fleet_cfg_json, override):
    for odc in override['debconf']:
        fleet_cfg_json['debconf'] = [x for x in fleet_cfg_json['debconf'] if x['key'] != odc['key']]
        fleet_cfg_json['debconf'].append(odc)

def find_partition_by_label(label):
    label_path = f"/dev/disk/by-label/{label}"
    if os.path.exists(label_path):
        return os.path.realpath(label_path)  # Resolve symlink to actual device path
    return None

def get_mount_point(partition):
    try:
        with open("/proc/mounts", "r") as mounts_file:
            for line in mounts_file:
                parts = line.split()
                if parts and parts[0] == partition:  # device path
                    return parts[1]  # mount point
    except Exception as e:
        print(f"Error reading /proc/mounts: {e}")
        sys.exit(1)
                
    return None

def find_bootdir():
    label = "boot"
    partition = find_partition_by_label(label)

    if partition:
        print(f"Found partition ({partition}) for LABEL=boot")
        mount_point = get_mount_point(partition)

        if mount_point:
            return mount_point
        else:
            print(f"Partition '{label}' exists but is not mounted. Please mount this disk before proceeding")
            sys.exit(1)
    else:
        print(f"No partition with label '{label}' found. Please insert and mount disk or provide --bootdir")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Jaiabot First Boot cloud-init user-data generator.")
    parser.add_argument('fleetcfg',  help="Path to fleet configuration file (protobuf TextFormat version of FleetConfig)")
    parser.add_argument('--bootdir', type=str, help="Path to boot directory (optional, if omitted the path to a mounted LABEL=boot partition will be used if found)")
    parser.add_argument('--binary', type=str, help="Name of binary")
    parser.add_argument('--debug',  help="Output debugging information", action="store_true")
    parser.add_argument('--hub-ssh-keys-only',  help="Only output the hub SSH keys (skip all other actions)", action="store_true")
    parser.add_argument('--mode', default="runtime", choices=["runtime", "simulation"], help="Whether this is a real (runtime) or virtual (simulation) system")
    parser.add_argument('type', choices=["bot", "hub"], help="Type of system to generate for")
    parser.add_argument('id', type=int, help="ID of bot or hub") 
    args = parser.parse_args()

    fleet_cfg_json = read_fleet_from_textproto(args.fleetcfg)
    fleet_cfg_json['this'] = dict();
    fleet_cfg_json['this']['type'] = args.type
    fleet_cfg_json['this']['id'] = args.id
    fleet_cfg_json['this']['mode'] = args.mode
    
    # make sure the bot/hub ID is actually defined in this fleet
    if args.id not in fleet_cfg_json[args.type + 's']:
        print(f"{args.type} {args.id} not included in {args.fleetcfg}")
        sys.exit(1)
        
    bootdir = args.bootdir
    if bootdir is None:
        bootdir = find_bootdir()
        print(f"Using {bootdir} for --bootdir based on mount point of LABEL=boot")
    
    # set overrides
    if 'debconfOverride' in fleet_cfg_json:
        for override in fleet_cfg_json['debconfOverride']:
            if override['type'] == args.type.upper() and override['id'] == args.id:
                merge_overrides(fleet_cfg_json, override)

    if not args.hub_ssh_keys_only:
        # generate first-boot.preseed.yml
        template_file=bootdir + '/jaiabot/init/first-boot.preseed.yml.j2'
        rendered_output = render_template(template_file, fleet_cfg_json)
        preseed_yml=bootdir + '/jaiabot/init/first-boot.preseed.yml'    
        with open(preseed_yml, "w") as f:
            f.write(rendered_output)

        # generate vpn key pair
        if 'vpnTmp' in fleet_cfg_json['ssh']:
            vpn_key_priv = bootdir + '/jaiabot/init/id_vpn_tmp'
            vpn_key_pub = vpn_key_priv + '.pub'
            with open(vpn_key_priv, "w") as f:
                f.write(fleet_cfg_json['ssh']['vpnTmp']['privateKey'])
            with open(vpn_key_pub, "w") as f:
                f.write(fleet_cfg_json['ssh']['vpnTmp']['publicKey'] + '\n')
            print(f"Wrote SSH key pair: {vpn_key_priv} and {vpn_key_pub}")
        else:
            print("WARNING: No vpn_tmp key provided")

    if args.type == 'hub':
        key_found=False
        if 'hub' in fleet_cfg_json['ssh']:
            for hub_key in fleet_cfg_json['ssh']['hub']:
                if args.id == hub_key['id']:
                    hub_key_priv = bootdir + f'/jaiabot/init/hub{args.id}_fleet{fleet_cfg_json["fleet"]}'
                    hub_key_pub = hub_key_priv + '.pub'
                    with open(hub_key_priv, "w") as f:
                        f.write(hub_key['privateKey'])
                    with open(hub_key_pub, "w") as f:
                        f.write(hub_key['publicKey'] + '\n')
                    print(f"Wrote SSH key pair: {hub_key_priv} and {hub_key_pub}")
                    key_found=True
        if not key_found:
            print(f"WARNING: No hub key provided for hub {args.id}")

        if not args.hub_ssh_keys_only:
            # Also put a copy of fleet config on hubs for future upgrades
            with open(args.fleetcfg, "rb") as src, open(bootdir + f'/jaiabot/init/fleet{fleet_cfg_json["fleet"]}.cfg', "wb") as dst:
                dst.write(src.read())

    if args.debug:
        print(f"Rendered FleetConfig as JSON: {json.dumps(fleet_cfg_json, indent=2)}")

    if not args.hub_ssh_keys_only:
        print(f'Wrote cloud-init file: {preseed_yml}')
        
if __name__ == "__main__":
    main()
