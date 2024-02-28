#!/usr/bin/env python3

import h5py
import numpy as np
import os

# Directions: 
#
# Navigate to the directory containing this file, run ./false_dive.py, and enter the file path
# to your .h5 files in the terminal.
#

def get_dive_data(directory_path):
    if not os.path.isabs(directory_path):
        directory_path = os.path.join(os.getcwd(), directory_path)

    if not os.path.exists(directory_path):
        print(f'The directory {directory_path} does not exist. Try again.')
        
        return
    
    for filename in os.listdir(directory_path):
        if filename.endswith('.h5'):
            file_path = os.path.join(directory_path, filename)
            #
            # Edit this file path to match your system
            #
            with h5py.File(file_path, 'r') as file:

                # Groups we're interested in
                taskPacket = file['jaiabot::task_packet;0/jaiabot.protobuf.TaskPacket']
                dives = file['jaiabot::task_packet;0/jaiabot.protobuf.TaskPacket/dive']
                temperature = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']
                battery_percentages = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']
                bot_status = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']

                # Specific data lists of each group
                bot_depths = np.array(dives['depth_achieved'])
                temps = np.array(temperature['temperature'])
                battery = np.array(battery_percentages['battery_percent'])
                utime = np.array(taskPacket['_utime_'])
                bot_status_time = np.array(bot_status['_utime_'])
                bot_id = np.array(bot_status['bot_id'])

                dive_indices = []
                false_indices = []
                failed_times = []
                time_indices = []

                fail_temps = []
                fail_battery_percents = []        

                # Get indices of all dives and false dives as an array of ints
                dive_indices = np.concatenate([dive_indices, np.where(bot_depths)[0]]).astype(int)
                false_indices = np.concatenate([false_indices, np.where(bot_depths < 1)[0]]).astype(int)

                for idx in false_indices:
                    failed_times.append(round(utime[idx] / 1_000_000))

                i = 0
                for status_time in bot_status_time:
                    i += 1
                    for time in failed_times:
                        if round(status_time / 1_000_000) == time:
                            time_indices.append(i)

                for idx in time_indices:
                    fail_temps.append(temps[idx])
                    fail_battery_percents.append(battery[idx])

                print(f'\nBOT ID: {bot_id[0]}')
                if len(fail_temps) > 0:
                    avg_fail_temp = sum(fail_temps) / len(fail_temps)
                    avg_fail_batt = sum(fail_battery_percents) / len(fail_battery_percents)
                    failure_rate = len(false_indices) / len(dive_indices) * 100
                
                    total_dives = len(dive_indices)
                    total_fails = len(false_indices)
                    print(f'Total Dives: {total_dives/2}')
                    print(f'Total Fails: {total_fails/2}')
                    print(f'\nFailure rate: {failure_rate:.2f}%\nAverage Failure Water Temp: {avg_fail_temp:.2f}\nAverage Failure Battery Percentage: {avg_fail_batt:.2f}\n')
                else: 
                    print("NO FAILED DIVES\n")

if __name__ == '__main__':

    directory_path = input('Enter the path to your log files (.h5): ')
    get_dive_data(directory_path)