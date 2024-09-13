from common import is_simulation, is_runtime


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
