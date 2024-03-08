#!/usr/bin/env python3

import h5py
import numpy as np
import os
import sys
import pytz
from datetime import datetime

""" Directions: 

    Navigate to the directory containing this file, run ./false_dive.py followed by the file path
    to your .h5 files in the terminal (e.g. './false_dive.py ~/path/to/.h5_directory/').

"""

def print_data(false_utimes: list[int], dive_indices: list[int], false_indices: list[int], bot_id: int):
    """ Prints the collected data. 
    
    Args:
        false_utimes (list of ints): List of all collected utimes from false dives. Used to print out the time of each false dive.
        dive_indices (list of ints): List of the indices of each dive's task packet. Used to determine the total number of dives attempted.
        false_indices (list of ints): List of the indices of each false dive's task packet. Used to determine the total number of false dives. 
        bot_id (int): Output with the rest of the data to help the user better understand which bot is currently being tracked. 

    Returns:
        None.
    """

    num_dives = len(dive_indices)
    num_false_dives = len(false_indices)

    print(f'\nBOT {bot_id}:')
    if num_false_dives > 0:
        print(f'False Dives: {num_false_dives}')
        print(f'Total Dives: {num_dives}')
        print(f'Failure Rate: {(num_false_dives / num_dives) * 100:.2f}%\n')
        print("False dive(s) occured at: ")
        
        for i in range(num_false_dives):
            print(utime_to_realtime(round(false_utimes[i] / 1_000_000)))

    else:
        print("NO FALSE DIVES.")
        print(f'COMPLETED {num_dives} DIVES.\n')


def test_time_stamps(utime_1: int, utime_2: int):
    """ Tests two different utimes to ensure they aren't within the same second. 
    
    Args: 
        utime_1 (int): First utime to compare against. Is converted to a date and time.
        utime_2 (int): Second utime to compare against. Is converted to a date and time. 

    Returns:
        True if the two utimes represent the same date/time (to the second), false if they do not. 
    """

    return utime_to_realtime(round(utime_1 / 1_000_000)) == utime_to_realtime(round(utime_2 / 1_000_000))


def utime_to_realtime(utime: int):
    """ Converts utime into a readable date/time.
    
    Args:
        utime (int): utime given to be converted. 
        
    Returns:
        dt (date/time): Converted and readable time.
    """

    dt = datetime.utcfromtimestamp(utime).replace(tzinfo=pytz.UTC)  
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt    


def get_dive_data(directory_path: str):
    """ Opens each .h5 file withint the given directory, handles the data, and locates any false dives within the file. 
    
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
    
    for filename in os.listdir(directory_path):
        if filename.endswith('.h5'):
            file_path = os.path.join(directory_path, filename)

            with h5py.File(file_path, 'r') as file:

                # Groups we're interested in
                taskPacket = file['jaiabot::task_packet;0/jaiabot.protobuf.TaskPacket']
                dives = file['jaiabot::task_packet;0/jaiabot.protobuf.TaskPacket/dive']                
                bot_status = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']

                # Specific data lists of each group
                depth_achieved = np.array(taskPacket['dive/depth_achieved'])
                utime = np.array(taskPacket['_utime_'])
                bot_id = np.array(bot_status['bot_id'])

                dive_indices = []
                false_indices = []
                false_utimes = []

                i = 0
                while i < len(depth_achieved):
                    dive_indices.append(i)
                    if depth_achieved[i] < 1 and not test_time_stamps(utime[i], utime[i-1]):
                        false_indices.append(i)
                        false_utimes.append(utime[i])
                    i += 1

                file.close()

                print_data(false_utimes, dive_indices, false_indices, bot_id[0])


def main():
    """ Driver function. Calls get_dive_data() with the user input directory path as an argument. 
    
    Args:
        directory_path (string): Gotten from command line input (e.g. ./false_dive.py ~/path/to/.h5_directory/)
        
    Returns:
        None.
    """

    directory_path = sys.argv[1]
    get_dive_data(directory_path)


if __name__ == '__main__':
    main()
    