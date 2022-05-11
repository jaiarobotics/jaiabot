from common import is_simulation, is_runtime


def gpsd_device(vehicle_id):
    if is_simulation():
        return '/dev/null'
    else:
        return '/dev/jaiabot/gps'

def gpsd_port(vehicle_id):
    default_gpsd_port=2947
    return default_gpsd_port
