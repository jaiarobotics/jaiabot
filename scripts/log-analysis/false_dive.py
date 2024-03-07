#!/usr/bin/env python3

import h5py
import numpy as np
import os
import sys
import pytz
from datetime import datetime

# Directions: 
#
# Navigate to the directory containing this file, run ./false_dive.py followed by the file path
# to your .h5 files in the terminal (e.g. './false_dive.py ~/jaia/dive_data/').
#

# Prints the data. Takes utime list, bot_id, dive_indices list, and false_indices list
def print_data(utimes, dives, false_dives, bot_id):
    num_dives = len(dives)
    num_false_dives = len(false_dives)

    print(f'\nBOT {bot_id}:')
    if len(false_dives) > 0:
        print(f'False Dives: {num_false_dives}')
        print(f'Total Dives: {num_dives}')
        print(f'Failure Rate: {(num_false_dives / num_dives) * 100:.2f}%\n')
        print("False dive(s) occured at: ")
        
        for time in false_dives:
            print(utime_to_realtime(round(utimes[time] / 1_000_000)))

    else:
        print("NO FALSE DIVES.")
        print(f'COMPLETED {num_dives} DIVES.\n')


# Test to make sure that one dive isn't being counted twice. Returns true if the utime of both indices is equal.
def test_time_stamps(utimes, idx_1, idx_2):
    return utime_to_realtime(round(utimes[idx_1] / 1_000_000)) == utime_to_realtime(round(utimes[idx_2] / 1_000_000))


# Converts utime into EST
def utime_to_realtime(utime):
    dt = datetime.utcfromtimestamp(utime).replace(tzinfo=pytz.UTC)  
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt    


def get_dive_data(directory_path):
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
                states = np.array(bot_status['mission_state'])
                depth_achieved = np.array(taskPacket['dive/depth_achieved'])
                temps = np.array(bot_status['temperature'])
                battery = np.array(bot_status['battery_percent'])
                utime = np.array(taskPacket['_utime_'])
                bot_status_time = np.array(bot_status['_utime_'])
                bot_id = np.array(bot_status['bot_id'])

                dive_indices = []
                false_indices = []

                i = 0
                while i < len(depth_achieved):
                    dive_indices.append(i)
                    if depth_achieved[i] < 1 and not test_time_stamps(utime, i, i-1):
                        false_indices.append(i)
                    i += 1

                file.close()

                print_data(utime, dive_indices, false_indices, bot_id[0])


def main():
    get_dive_data()


if __name__ == '__main__':

    directory_path = sys.argv[1]
    get_dive_data(directory_path)