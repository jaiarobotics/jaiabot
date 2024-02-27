#!/usr/bin/env python3

import numpy as np
import h5py
import os
from datetime import datetime
#import pytz
from math import sin, cos, atan, sqrt, radians, asin


# Currently, this program loops through each .h5 file in the directory defined in DIRECTORY_PATH and keeps track of the time a bot is in transit mode, and it's distance travelled while in transit mode. 
# The parameters for these are defined below in TIME_TOLERANCE and DIST_TOLERANCE. Updating these will adjust how we define a "false transit".
TIME_TOLERANCE = 10
DIST_TOLERANCE = 5
MICROSECOND_FACTOR = 1_000_000

class Point: 
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon

# Converts utime into EST
#def utime_to_realtime(utime):
 #   dt = datetime.utcfromtimestamp(utime).replace(tzinfo=pytz.UTC)
  #  desired_tz = pytz.timezone('America/New_York')
   # dt = dt.astimezone(desired_tz)

    #return dt

# Takes in two Points and uses Haversine formula to return the distance between them in meters
def get_distance(point1, point2):
    # Earth's radius (km)
    R = 6371
    lat1 = point1.lat
    lon1 = point1.lon
    lat2 = point2.lat
    lon2 = point2.lon

    # Convert degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2

    a = min(1, a)
    c = 2 * asin(sqrt(a))

    return round(R * c * 1000)


# Outputs list of Pitches, Times, and the Mission States of a bot when it experiences a false transit
# From the time a Transit command is sent, the bot has 5 seconds (defined as the global variable TOLERANCE) before
# the transit is output as a failure.
def get_transit_data(DIRECTORY_PATH):
    for filename in os.listdir(DIRECTORY_PATH):
        if filename.endswith('.h5'):
            filepath = os.path.join(DIRECTORY_PATH, filename)

            num_transits = 0
            num_false_transits = 0

            with h5py.File(filepath, 'r') as file:
                # Groups we're interested in
                bot_status = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']

                # Specific datasets
                states = np.array(bot_status['mission_state'])
                utimes = np.array(bot_status['_utime_'])
                bot_id = np.array(bot_status['bot_id'])
                bot_lats = np.array(bot_status['location/lat'])
                bot_lons = np.array(bot_status['location/lon'])

                print(f'BOT ID: {bot_id[0]}\n')
                
                i = 0
                while i < len(states) - 2*TIME_TOLERANCE:
                    if states[i] == 110:
                        j = 0
                        while states[i + j]:
                            if states[i + j] != states[i]:
                                num_transits += 1
                                i += j
                                break
                            else:
                                j += 1
                    i += 1

                # Loops through all states
                i = 0
                while i < len(states) - 2*TIME_TOLERANCE:
                    # Location info
                    last_loc = Point(bot_lats[i], bot_lons[i])
                    new_loc = Point(bot_lats[i + 2*TIME_TOLERANCE], bot_lons[i + 2*TIME_TOLERANCE])
                    dist_travelled = get_distance(last_loc, new_loc)

                    # Time info
                    initial_utime = round(utimes[i] / MICROSECOND_FACTOR)
                    cur_utime = round(utimes[i + 2*TIME_TOLERANCE] / MICROSECOND_FACTOR)
                    time_difference = cur_utime - initial_utime

                    
                        

                    # If the state is 'in transit' (transit = 110), time passed has exceeded the tolerance, and the bot hasn't moved outside of the tolerance zone
                    if states[i] == 110 and states[i + 2*TIME_TOLERANCE] == 110 and time_difference == TIME_TOLERANCE and dist_travelled < DIST_TOLERANCE:
                        num_false_transits += 1
                        print(f'False Transit {num_false_transits}: Distance Travelled: {dist_travelled}m')
                        i += 2*TIME_TOLERANCE
                    else:
                        i += 1

            print(f'Num transits: {num_transits}, Num false transits: {num_false_transits}, False Transit Rate: {num_false_transits / num_transits * 100:.2f}%\n\n')

def main():
    DIRECTORY_PATH = input("Enter the filepath to the directory containing the data files (.h5): ")
    get_transit_data(DIRECTORY_PATH)

if __name__ == "__main__":
    main()