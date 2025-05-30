#!/usr/bin/env python3

from sys import argv
import json
from random import uniform, sample
from datetime import datetime
from math import cos, pi


taskpacket_files = 200
taskpackets_per_file = 10
bots = 5
lat_range = [41.661484, 41.761484]
lon_range = [-71.272681, -71.372681]
depth_wavelength = 0.001
max_age_seconds = 28 * 24 * 60 * 60

dir = '/var/log/jaiabot/bot_offload/'


for i in range(taskpacket_files):
    with open(dir + f'mock_{i}.taskpacket', 'w') as file:

        for j in range(taskpackets_per_file):
            location = {"lat": uniform(*lat_range), "lon": uniform(*lon_range)}
            end_location = {"lat": location["lat"] + 0.01, "lon": location["lon"] + 0.01}

            depth = cos(location["lat"] * 2 * pi / depth_wavelength) * cos(location["lon"] * 2 * pi / depth_wavelength)

            now = datetime.now().timestamp()
            start_time = int(uniform(now - max_age_seconds, now) * 1_000_000)
            end_time = start_time + 60_000_000

            taskpacket = {  "bot_id": sample(range(bots), 1)[0], 
                            "dive": {"bottom_dive": True, 
                                "bottom_type": "SOFT", 
                                "depth_achieved": depth, 
                                "dive_rate": 0.5, 
                                "duration_to_acquire_gps": 29.9, 
                                "max_acceleration": 0.0, 
                                "measurement": [{}], 
                                "start_location": location, 
                                "unpowered_rise_rate": 0.1}, 
                            "drift": {"drift_duration": 20, 
                                        "end_location": end_location, 
                                        "estimated_drift": {"heading": 180.0, 
                                                            "speed": 0.3}, 
                                        "significant_wave_height": 0.0, 
                                        "start_location": location}, 
                            "end_time": str(end_time), 
                            "start_time": str(start_time), 
                            "type": "DIVE"}

            json.dump(taskpacket, file)
            file.write('\n')

