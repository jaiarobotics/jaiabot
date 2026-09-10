from common import is_simulation, is_runtime
import yaml


def gpsd_device():
    if is_simulation():
        return '/dev/null'
    else:
        return '/dev/gps0'

def gpsd_port(hub_id):
    if is_simulation():
        return 32000 + hub_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port

def expected_hubs_from_inventory():
    try:
        with open('/etc/jaiabot/inventory.yml', 'r') as file:
            data = yaml.safe_load(file)            
            hubs = data.get("hubs", {}).get("hosts", {}).keys()
            hub_ids = [int(hub.split('-')[0][3:]) for hub in hubs]
            return hub_ids
    except FileNotFoundError:
        default_hub_id = 1
        return [default_hub_id]
    

def cloud_env():
    env = {}
    try:
        with open('/etc/jaiabot/cloud.env', 'r') as file:
            for line in file:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                env[key] = value.strip('"')
    except FileNotFoundError:
        pass
    return env
