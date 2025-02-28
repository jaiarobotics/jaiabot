from common import is_simulation, is_runtime
import yaml


def gpsd_device(node_id):
    if is_simulation():
        return '/dev/null'
    else:
        return '/dev/gps0'

def gpsd_port(node_id):
    if is_simulation():
        return 32000 + node_id
    else:
        default_gpsd_port=2947
        return default_gpsd_port

def expected_bots_from_inventory():
    if is_simulation():
        return ''

    try:
        with open('/etc/jaiabot/inventory.yml', 'r') as file:
            data = yaml.safe_load(file)            
            bots = data.get("bots", {}).get("hosts", {}).keys()
            bot_ids = [int(bot.split('-')[0][3:]) for bot in bots]
            return f"id: {bot_ids}"        
    except FileNotFoundError:
        return ''
    
