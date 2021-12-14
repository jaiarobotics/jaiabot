subnet_mask=0xFF00
subnet_index={'wifi': 0}
num_modems_in_subnet=(0xFFFF ^ subnet_mask)+1

# Broadcast is modem id = 0 in Goby, so increment vehicle id by 1 to get base modem id
def base_modem_id(vehicle_id):
    return vehicle_id + 1

def wifi_modem_id(vehicle_id):
    return base_modem_id(vehicle_id) + subnet_index['wifi']*num_modems_in_subnet

# first id is hub id
hub_vehicle_id=0

def wifi_mac_slots(vehicle_id):
    slots = 'slot { src: ' + str(wifi_modem_id(vehicle_id)) + ' slot_seconds: 1 max_frame_bytes: 128 }\n'
    return slots

