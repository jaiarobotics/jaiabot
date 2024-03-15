#!/usr/bin/env python3

import numpy as np
import h5py
import os
import sys
from datetime import datetime
import pytz
from math import sin, cos, atan, sqrt, radians, asin

"""Directions: 

    Navigate to the directory containing this file, run ./false_transit.py followed by the file path
    to your .h5 files in the terminal (e.g. './false_dive.py ~/path/to/.h5_directory/').

"""
MICROSECOND_FACTOR = 1_000_000

# Update TIME_TOLERANCE or DIST_TOLERANCE to change acceptable parameters
TIME_TOLERANCE = 10 # Seconds
DIST_TOLERANCE = 5  # Meters

class Point: 
    def __init__(self, lat, lon):
        """Used to keep track of the location of a bot
        
        Args:
            lat (Float): Latitude of the bot
            lon (Float): Longitude of the bot
            
        Returns:
            None.
        """
        self.lat = lat
        self.lon = lon

def utime_to_realtime(utime):
    """Converts a utime into a readable datetime in EST. Change desired_tz to update timezone.
    
    Args:
        utime (int): Utime to be converted
    
    Returns:
        datetime: Converted utime in EST"""
    dt = datetime.datetime.fromtimestamp(utime, datetime.timezone.utc)    
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt

def get_distance(point1, point2):
    """Finds the distance between two points on the Earth's surface using the Haversine Formula.
    
    Args:
        point1 (Point): The point (lat/lon) of a bot at a certain time
        point2 (Point): The point (lat/lon) of a bot at a different time
        
    Returns:
        int: Distance between the two points in meters
    """
    R = 6371 # Earth's radius (km)
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

    return round(R * c * 1000) # Haversine formula

def get_transit_data(directory_path):
    """Opens each .h5 file in the given directory path and interprets data. Finds and returns the distance travelled 
       and time of any false transit. 
    
    Args:
        directory_path (str): Path to the users' directory containing the .h5 files in question
        
    Returns:
        None.
    """
    if not os.path.isabs(directory_path):
        directory_path = os.path.join(os.getcwd(), directory_path)

    if not os.path.exists(directory_path):
        print(f'The directory {directory_path} does not exist. Try again.')
        return
    
    has_h5 = False
    for filename in os.listdir(directory_path):
        if filename.endswith('.h5'):
            filepath = os.path.join(directory_path, filename)

            has_h5 = True
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
                        print(f'False Transit {num_false_transits}: Distance Travelled: {dist_travelled}m, {utime_to_realtime(cur_utime)}')
                        i += 2*TIME_TOLERANCE
                    else:
                        i += 1

            print(f'Num transits: {num_transits}, Num false transits: {num_false_transits}, False Transit Rate: {num_false_transits / num_transits * 100:.2f}%\n\n')

    if not has_h5:
        print(f'No .h5 files found in {directory_path}')
        
def main():
    directory_path = sys.argv[1]
    get_transit_data(directory_path)

if __name__ == "__main__":
    main()