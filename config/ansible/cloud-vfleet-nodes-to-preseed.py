#!/usr/bin/env python3

import yaml

# Path to the YAML file
yaml_file_path = 'vars/vfleet_nodes.yml'

# Path to the output file
output_file_path = '/etc/jaiabot/fleet-config.preseed'

# Read the YAML content from the file
with open(yaml_file_path, 'r') as file:
    data = yaml.safe_load(file)

# Initialize lists for hubs and bots
jaia_hubs = []
jaia_bots = []

# Iterate and populate lists
for node in data['node_map']:
    if node['node_type'] == 'hub':
        jaia_hubs.append(f"\"{node['node_id']}\"")
    elif node['node_type'] == 'bot':
        jaia_bots.append(f"\"{node['node_id']}\"")

# Convert lists to space-separated strings
jaia_hubs_str = ' '.join(jaia_hubs)
jaia_bots_str = ' '.join(jaia_bots)

# Predefined content
jaia_is_real_fleet = 'no'
jaia_actions = '"ssh-keys" "ansible-inventory" "reboot"'

# Write the output to the file
with open(output_file_path, 'w') as file:
    file.write(f"jaia_is_real_fleet={jaia_is_real_fleet}\n")
    file.write(f"jaia_hubs='{jaia_hubs_str}'\n")
    file.write(f"jaia_bots='{jaia_bots_str}'\n")
    file.write(f"jaia_actions='{jaia_actions}'\n")

print(f"Configuration written to {output_file_path}")