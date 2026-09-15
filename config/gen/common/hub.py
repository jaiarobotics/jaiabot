from common import is_simulation, is_runtime
import common.comms
import common.udp
import yaml


def gpsd_device():
    if is_simulation():
        return '/dev/null'
    else:
        return "udp://127.0.0.1:" + str(common.udp.gpsd_udp_port(common.comms.hub_node_id))

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
    
