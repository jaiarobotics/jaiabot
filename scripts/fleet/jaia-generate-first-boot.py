#!/usr/bin/env python3

import sys
import os

# A bit hacky, but we need to do this until we properly install pyjaiaprotobuf
def set_pythonpath():
    script_path = os.path.abspath(__file__)
    script_dir = os.path.dirname(script_path)
    python_path = os.path.join(script_dir, "../share/jaiabot/python/pyjaiaprotobuf/src")

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

def find_bootdir(label):
    partition = find_partition_by_label(label)
    
    if partition:
        print(f"Found partition ({partition}) for LABEL={label}")
        mount_point = get_mount_point(partition)

        if mount_point:
            return mount_point
        else:
            print(f"Partition '{label}' exists but is not mounted. Please mount this disk before proceeding")
            sys.exit(1)
    else:
        return None

def main():
    parser = argparse.ArgumentParser(description="Jaiabot First Boot cloud-init user-data generator.")
    parser.add_argument('fleetcfg',  help="Path to fleet configuration file (protobuf TextFormat version of FleetConfig)")
    parser.add_argument('--bootdir', type=str, help="Path to boot directory (optional, if omitted the path to a mounted LABEL=boot partition will be used if found)")
    parser.add_argument('--binary', type=str, help="Name of binary")
    parser.add_argument('--debug',  help="Output debugging information", action="store_true")
    parser.add_argument('--hub-ssh-keys-only',  help="Only output the hub SSH keys (skip all other actions). Same as --action=hub_ssh_keys.", action="store_true")
    parser.add_argument('--mode', default="runtime", choices=["runtime", "simulation"], help="Whether this is a real (runtime) or virtual (simulation) system")
    parser.add_argument('--action', action='append', choices=["hub_ssh_keys", "vpn_key", "first_boot", "store_fleet_cfg", "new_hub_script"], help="Actions to take (default is ['hub_ssh_keys', 'vpn_key', 'first_boot', 'store_fleet_cfg'])")
    parser.add_argument('type', choices=["bot", "hub", "rpicam"], help="Type of system to generate for")
    parser.add_argument('id', type=int, help="ID of bot or hub") 
    args = parser.parse_args()

    fleet_cfg_json = read_fleet_from_textproto(args.fleetcfg)
    fleet_cfg_json['this'] = dict();
    fleet_cfg_json['this']['type'] = args.type
    fleet_cfg_json['this']['id'] = args.id
    fleet_cfg_json['this']['mode'] = args.mode

    node_ip_result = subprocess.run(['jaia', 'ip', '--query_type', 'addr', '--node_type', args.type, '--ip_net', 'wlan', '--fleet_id', str(fleet_cfg_json["fleet"]), '--node_id', str(args.id), '--ip_version', 'ipv4'], capture_output=True, text=True, check=True)
    fleet_cfg_json['this']['ip'] = node_ip_result.stdout.strip()

    gateway_ip_result = subprocess.run(['jaia', 'ip', '--query_type', 'addr', '--node_type', 'gateway', '--ip_net', 'wlan', '--fleet_id', str(fleet_cfg_json["fleet"]), '--ip_version', 'ipv4'], capture_output=True, text=True, check=True)
    fleet_cfg_json['this']['gateway_ip'] = gateway_ip_result.stdout.strip()

    actions=args.action
    if args.hub_ssh_keys_only:
        actions=['hub_ssh_keys']
    elif actions is None:
        actions=['hub_ssh_keys', 'vpn_key', 'first_boot', 'store_fleet_cfg']

    print(f"Running actions: {actions}")
        
    # special case types
    type=args.type
    if args.type == 'rpicam':
        type='bot'
        
    # make sure the bot/hub ID is actually defined in this fleet
    if args.id not in fleet_cfg_json[type + 's']:
        print(f"{type} {args.id} not included in {args.fleetcfg}")
        sys.exit(1)
        
    bootdir = args.bootdir

    # if not specified on the command line, search for boot dir
    if bootdir is None:
        boot_labels = ['boot', 'bootfs']
        for label in boot_labels:
            bootdir = find_bootdir(label)
            if bootdir is not None:
                print(f"Using {bootdir} for --bootdir based on mount point of LABEL={label}")
                break

    # error if boot dir is still not found
    if bootdir is None:
        print(f"No partition with label with any of '{boot_labels}' found. Please insert and mount disk or provide --bootdir")
        sys.exit(1)
        
    # set overrides
    if 'debconfOverride' in fleet_cfg_json:
        for override in fleet_cfg_json['debconfOverride']:
            if override['type'] == type.upper() and override['id'] == args.id:
                merge_overrides(fleet_cfg_json, override)

    if 'first_boot' in actions:
        # generate first-boot.preseed.yml
        template_file=bootdir + '/jaiabot/init/first-boot.preseed.yml.j2'
        rendered_output = render_template(template_file, fleet_cfg_json)
        preseed_yml=bootdir + '/jaiabot/init/first-boot.preseed.yml'    
        with open(preseed_yml, "w") as f:
            f.write(rendered_output)
        print(f'Wrote cloud-init file: {preseed_yml}')
            
    if 'new_hub_script' in actions:
        # generate new_hub.sh
        template_file=bootdir + '/new_hub.sh.j2'
        rendered_output = render_template(template_file, fleet_cfg_json)
        new_hub_script=bootdir + '/new_hub.sh'    
        with open(new_hub_script, "w") as f:
            f.write(rendered_output)
        print(f'Wrote new hub script: {new_hub_script}')
            
    if 'vpn_key' in actions:
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

        if 'comms' in fleet_cfg_json:
            # generate iridium config
            if 'iridiumSbd' in fleet_cfg_json['comms']:
                iridium_cfg = bootdir + '/jaiabot/init/iridium.json'
                with open(iridium_cfg, "w") as f:
                    json.dump(fleet_cfg_json['comms']['iridiumSbd'], f)

    if type == 'hub':
        if 'hub_ssh_keys' in actions:
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

        if 'store_fleet_cfg' in actions:
            # Also put a copy of fleet config on hubs for future upgrades
            with open(args.fleetcfg, "rb") as src, open(bootdir + f'/jaiabot/init/fleet{fleet_cfg_json["fleet"]}.cfg', "wb") as dst:
                dst.write(src.read())

    if args.debug:
        print(f"Rendered FleetConfig as JSON: {json.dumps(fleet_cfg_json, indent=2)}")
        
if __name__ == "__main__":
    main()
