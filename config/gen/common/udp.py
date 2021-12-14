from common import is_simulation, is_runtime
from common import comms

def wifi_udp_port(vehicle_id):
    return 31000 + comms.wifi_modem_id(vehicle_id)
