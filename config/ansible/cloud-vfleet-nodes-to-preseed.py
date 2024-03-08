#!/usr/bin/env python3

import sys

# Check if the command line argument (n_bots) is provided
if len(sys.argv) < 2:
    print("Usage: cloud-vfleet-nodes-to-preseed.py <n_bots>")
    sys.exit(1)

# Read the number of bots from the first command line argument
n_bots = int(sys.argv[1])

output_file_path = '/etc/jaiabot/fleet-config.preseed'

# Generate the node_map dynamically based on n_bots
node_map = [{'node_type': 'hub', 'node_id': '1'}]
node_map += [{'node_type': 'bot', 'node_id': str(i)} for i in range(1, n_bots + 1)]

jaia_hubs = []
jaia_bots = []

for node in node_map:
    if node['node_type'] == 'hub':
        jaia_hubs.append(f"\"{node['node_id']}\"")
    elif node['node_type'] == 'bot':
        jaia_bots.append(f"\"{node['node_id']}\"")

jaia_hubs_str = ' '.join(jaia_hubs)
jaia_bots_str = ' '.join(jaia_bots)

jaia_is_real_fleet = 'no'

# do not reboot - not reliable for some reason after running fleet-config.sh - we'll use Ansible to stop/start
jaia_actions = '"ssh-keys" "ansible-inventory"'

# Write the output to the file
with open(output_file_path, 'w') as file:
    file.write(f"jaia_is_real_fleet={jaia_is_real_fleet}\n")
    file.write(f"jaia_hubs='{jaia_hubs_str}'\n")
    file.write(f"jaia_bots='{jaia_bots_str}'\n")
    file.write(f"jaia_actions='{jaia_actions}'\n")

print(f"Configuration written to {output_file_path}")
