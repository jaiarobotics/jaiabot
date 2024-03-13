#!/usr/bin/env python3

import h5py
import numpy as np
import os
import sys
import pytz
from datetime import datetime

"""Directions: 

    Navigate to the directory containing this file, run ./false_dive.py followed by the file path
    to your .h5 files in the terminal (e.g. './false_dive.py ~/path/to/.h5_directory/').

"""

MICORSECONDS_FACTOR = 1_000_000

def print_data(false_utimes: list[int], dive_count: int, false_dive_count: int, bot_id: int):
    """Prints the collected data. 
    
    Args:
        false_utimes (list of ints): Used to print out the time of each false dive.
        dive_indices (list of ints): Used to determine the total number of dives attempted.
        false_indices (list of ints): Used to determine the total number of false dives. 
        bot_id (int): Helps the user better understand which bot is currently being tracked. 

    Returns:
        None.
    """
    print(f'\nBOT {bot_id}:')
    if false_dive_count > 0:
        print(f'False Dives: {false_dive_count}')
        print(f'Total Dives: {dive_count}')
        print(f'Failure Rate: {(false_dive_count / dive_count) * 100:.2f}%\n')
        print("False dive(s) occured at: ")
        
        for i in range(false_dive_count):
            print(utime_to_realtime(round(false_utimes[i] / MICORSECONDS_FACTOR)))

    else:
        print("NO FALSE DIVES.")
        print(f'COMPLETED {dive_count} DIVES.\n')


def test_time_stamps(utime_1: int, utime_2: int):
    """Tests two different utimes to ensure they aren't within the same second. 
    
    Args: 
        utime_1 (int): First utime to compare against. Is converted to a date and time.
        utime_2 (int): Second utime to compare against. Is converted to a date and time. 

    Returns:
        Bool: True if the two utimes represent the same date/time (to the second), false if they do not. 
    """
    return utime_to_realtime(round(utime_1 / MICORSECONDS_FACTOR)) == utime_to_realtime(round(utime_2 / MICORSECONDS_FACTOR))


def utime_to_realtime(utime: int):
    """Converts utime into a readable date/time.
    
    Args:
        utime (int): utime given to be converted. 
        
    Returns:
        datetime: Converted and readable time.
    """
    dt = datetime.utcfromtimestamp(utime).replace(tzinfo=pytz.UTC)  
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt    


def get_dive_data(directory_path: str):
    """Opens each .h5 file within the given directory, handles the data, and locates any false dives within the file. 
    
    Args:
        directory_path (str): Path to the users' directory that contains the .h5 files in question.
        
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
            has_h5 = True
            file_path = os.path.join(directory_path, filename)

            with h5py.File(file_path, 'r') as file:

                # Groups we're interested in
                task_packet = file['jaiabot::task_packet;0/jaiabot.protobuf.TaskPacket']
                bot_status = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']

                # Specific data lists of each group
                depth_achieved = np.array(task_packet['dive/depth_achieved'])
                utime = np.array(task_packet['_utime_'])
                bot_id = np.array(bot_status['bot_id'])

                false_utimes = []
                dive_count = 0
                false_dive_count = 0

                i = 0
                while i < len(depth_achieved):
                    dive_count += 1
                    if depth_achieved[i] < 1 and not test_time_stamps(utime[i], utime[i-1]):
                        false_dive_count += 1
                        false_utimes.append(utime[i])
                    i += 1

                file.close()

                print_data(false_utimes, dive_count, false_dive_count, bot_id[0])
    
    if not has_h5:
        print(f'No .h5 files found in {directory_path}')

def main():
    """Driver function. Calls get_dive_data() with the user input directory path as an argument. 
    
    Args:
        None.
        
    Returns:
        None.
    """
    directory_path = sys.argv[1]
    get_dive_data(directory_path)


if __name__ == '__main__':
    main()
    