#!/usr/bin/env python3

import numpy as np
import h5py
import os
import sys
import datetime
import pytz
from math import sin, cos, atan, sqrt, radians, asin

"""Directions: 

    Navigate to the directory containing this file, run ./false_transit.py followed by the file path
    to your .h5 files in the terminal (e.g. './false_dive.py ~/path/to/.h5_directory/').

    To change analysis parameters, use command-line arguments as follows:
    './false_dive.py ~/path/to/.h5_directory/ new_pitch_threshold new_speed_threshold new_time_threshold'
"""
MICROSECOND_FACTOR = 1_000_000

class Transit:
    """Class used to keep track of each transit. Stores the beginning and ending index of the transit from bot status"""
    def __init__(self, beg, end):
        self.beg = beg
        self.end = end

class FalseTransit:
    """Class used to keep track of each false transit. Stores the beginning and ending index, and time that the transit began at from bot status"""
    def __init__(self, beg, end, time):
        self.beg = beg
        self.end = end
        self.time = time

def getDesiredSpeedIdx(ds_utimes, utime): 
    """Converts the index of a bot_status message to a desired_setpoints message
    
    Args:
        ds_utimes (Array of ints): Utimes recorded by desired_setpoints messages
        utime (Int): The utime used to get convert from bot_status to desired_setpoints
        
    Returns:
        int: The index of the utime in ds_utimes if it exists, and 0 otherwise 
    """
    for i in range(len(ds_utimes)):
        if round(ds_utimes[i] / MICROSECOND_FACTOR) == utime:
            return i
        
    return 0

def utime_to_realtime(utime):
    """Converts a utime into a readable datetime in EST. Change desired_tz to update timezone.
    
    Args:
        utime (int): Utime to be converted
    
    Returns:
        datetime: Converted utime in EST
    """
    dt = datetime.datetime.fromtimestamp(utime, datetime.timezone.utc)    
    desired_tz = pytz.timezone('America/New_York')
    dt = dt.astimezone(desired_tz)

    return dt

def get_transit_data(directory_path):
    """Opens each .h5 file in the given directory path and interprets data. Finds and returns the distance travelled 
       and time of any false transit. 
    
    Args:
        directory_path (str): Path to the users' directory containing the .h5 files in question
        
    Returns:
        None.
    """

    #Finds filepath whether its absolute or not
    if not os.path.isabs(directory_path):
        directory_path = os.path.join(os.getcwd(), directory_path)

    #Tests if the filepath exists
    if not os.path.exists(directory_path):
        print(f'The directory {directory_path} does not exist. Try again.')
        return
    
    #Print out thresholds for each input parameter
    print(f'\nPitch threshold: {resolve_pitch_threshold}º')
    print(f'Desired speed threshold: {resolve_desired_speed_threshold} m/s')
    print(f'Time threshold: {resolve_no_forward_progress_timeout} sec\n')

    has_h5 = False
    for filename in os.listdir(directory_path):
        if filename.endswith('.h5'):
            filepath = os.path.join(directory_path, filename)

            has_h5 = True
            with h5py.File(filepath, 'r') as file:
                #Groups we're interested in
                bot_status = file['jaiabot::bot_status;0/jaiabot.protobuf.BotStatus']
                desired_setpoints = file['jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints']

                #Specific datasets
                states = np.array(bot_status['mission_state']) #Array of all states recorded in the mission
                schemes = np.array(bot_status['_scheme_']) #Array of the schemes of each measurement. scheme 1=exact values, scheme 2=rounded values
                utimes = np.array(bot_status['_utime_']) #Array of the utimes of each bot_status measurement
                bot_id = np.array(bot_status['bot_id']) #bot_id. This is an array so use bot_id[0]
                pitches = np.array(bot_status['attitude/pitch']) #Array of all pitches the bot was in
                desired_speeds = np.array(desired_setpoints['helm_course/speed']) #Array of the goal speeds of the bot 
                ds_utimes = np.array(desired_setpoints['_utime_']) #Array of the utimes for desired_setpoints. Used to convert the index of a bot_status element to a desired_setpoint element

                print(f'BOT ID: {bot_id[0]}')
                
                transits = [] #List of all transits found
                false_transits = [] #List of any false transits

                #Loops through all states to get the total number of transits that occured
                #If a transit state (110) is entered and then a state change occurs, a transit is detected and recorded
                i = 0
                while i < len(states):
                    if states[i] == 110 and schemes[i] == 1:
                        j = 0
                        while states[i + j]:
                            if schemes[i + j] == 1 and states[i + j] != states[i]:
                                transits.append(Transit(i, j))
                                i += j
                                break
                            else:
                                j += 1
                    i += 1
                    
                #Loops through each transit and tests to see if it was false
                for transit in transits:
                    idx = transit.beg
                    j = 0
            
                    initial_utime = round(utimes[idx] / MICROSECOND_FACTOR) #Startting utime of the transit
                    desired_speed_idx = getDesiredSpeedIdx(ds_utimes, utimes[idx]) #Goal speed at the beginning of the transit

                    #Loops through each bot_status index between each transit.beg and transit.end
                    while j < transit.end:
                        cur_pitch = pitches[idx + j] #Current pitch of the bot at bot_status index [idx + j]
                        cur_desired_speed = desired_speeds[desired_speed_idx + j] #Goal speed at bot_status index [idx + j]
                        
                        #Time info
                        cur_utime = round(utimes[idx + j] / MICROSECOND_FACTOR) #Utime at bot_status index [idx + j]
                        time_difference = cur_utime - initial_utime #Difference in seconds

                        #If the bot is vertical (or close to it), is supposed to be moving, and has been sitting for longer than the allowed time tolerance, record a false transit
                        if cur_pitch > resolve_pitch_threshold and cur_desired_speed > resolve_desired_speed_threshold and time_difference >= resolve_no_forward_progress_timeout:
                            time = utime_to_realtime(round(utimes[idx] / MICROSECOND_FACTOR))
                            false_transits.append(FalseTransit(transit.beg, transit.end, time))
                            break
                        
                        j += 1

                #Print out transit data for each bot
                num_transits = len(transits)
                num_false_transits = len(false_transits)

                if num_false_transits != 0:
                    print(f'Num transits: {num_transits}, Num false transits: {num_false_transits}, False Transit Rate: {num_false_transits / num_transits * 100:.2f}%\n')
                    print("     False Transit time(s): ")
                    for transit in  false_transits:
                        print('      ', transit.time)
                    print()
                else:
                    print("NO FALSE TRANSITS DETECTED\n")

    if not has_h5:
        print(f'No .h5 files found in {directory_path}')
        
def main():
    #Default analysis parameters
    global resolve_pitch_threshold #Degrees (90 = vertical)
    global resolve_desired_speed_threshold #m/s
    global resolve_no_forward_progress_timeout #Seconds

    resolve_pitch_threshold = 60 
    resolve_desired_speed_threshold = 0 
    resolve_no_forward_progress_timeout = 15 

    argc = len(sys.argv)
    directory_path = sys.argv[1]

    if argc >= 3:
        resolve_pitch_threshold = int(sys.argv[2])

    if argc >= 4:
        resolve_desired_speed_threshold = int(sys.argv[3])

    if argc >= 5:
        resolve_no_forward_progress_timeout = int(sys.argv[4])

    get_transit_data(directory_path)

if __name__ == "__main__":
    main()