import sys
import os
from pathlib import Path

path = str(Path().absolute())

print("Path: ", path)

sys.path.append(path)

# If we're a CloudHub, read the remote real hubs' IP address(es) and other data
cloud_env_file = '/etc/jaiabot/cloud.env'
if os.path.exists(cloud_env_file):
    with open(cloud_env_file, 'r') as file:
        for line in file:
            key, value = line.strip().split('=', 1)
            if key == 'jaia_jcc_hub_ip':
                os.environ['JCC_HUB_IP'] = value
            elif key == 'jaia_rest_api_private_key':
                os.environ['JAIA_REST_API_PRIVATE_KEY'] = value
else:
    # Allow access to API without key on local HUB
    os.environ['JAIA_REST_API_PRIVATE_KEY'] = ""

from app import app as application
