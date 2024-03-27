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
        './false_dive.py ~/path/to/.h5_directory/ pitch_threshold speed_threshold timeout_threshold'

"""
MICROSECOND_FACTOR = 1_000_000 #Used to convert utime to seconds

class Transit:
    """Class used to keep track of each transit. Stores the beginning and ending index of the transit from bot status"""
    def __init__(self, beg, end, desired_speed):
        self.beg = beg
        self.end = end
        self.desired_speed = desired_speed

class FalseTransit:
    """Class used to keep track of each false transit. Stores the beginning and ending index, and time that the transit began at from bot status"""
    def __init__(self, beg, end, start_time, end_time):
        self.beg = beg
        self.end = end
        self.start_time = start_time
        self.end_time = end_time

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
    print("\nCURRENT THRESHOLDS:")
    print(f'Pitch threshold: {resolve_pitch_threshold}º')
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
                utimes = np.array(bot_status['_utime_']) #Array of the utimes of each bot_status measurement
                bot_id = np.array(bot_status['bot_id']) #bot_id. This is an array so use bot_id[0]
                pitches = np.array(bot_status['attitude/pitch']) #Array of all pitches the bot was in
                desired_speeds = np.array(desired_setpoints['helm_course/speed']) #Array of the goal speeds of the bot 
                ds_utimes = np.array(desired_setpoints['_utime_']) #Array of the utimes from desired_setpoints. Used to convert the index of a bot_status element to a desired_setpoint element
                ds_schemes = np.array(desired_setpoints['_scheme_'])#Array of the schemes of each measurement from desired_setpoints. scheme 1=exact values, scheme 2=rounded values

                print(f'BOT ID: {bot_id[0]}')
                
                transits = [] #List of all transits found
                false_transits = [] #List of any false transits
                
                #Loops through all desired speeds (from desired_setpoints) to find each transit / transit attempt
                #If the desired speed becomes > 0, a transit attempt has begun. Once the desired speed is set back to 0, the transit attempt is complete. 
                #At this point, the transit's beginning and ending index in desired_speeds, and its beginning desired_speed is recorded
                i = 0
                begin = 0
                end = 0
                while i < len(desired_speeds):
                    if desired_speeds[i] > 0 and ds_schemes[i] == 1: #Began transit
                        begin = i
                        j = 1
                        while desired_speeds[i + j] < len(desired_speeds) and desired_speeds[i + j] > 0: #When loop is finished, the transit is complete. i + j represents the index where the transit is complete in desired_speeds
                            j += 1

                        i += j
                        end = i + j
                        transits.append(Transit(begin, end, desired_speeds[begin]))

                    i += 1        
           
                #Round each value in ds_utimes and utimes to the nearest second to allow for easier conversion from bot_status utime to desired_setpoint utimes
                utime_rounder = lambda t: round(t / MICROSECOND_FACTOR)
                utimes = np.array([utime_rounder(elem) for elem in utimes])
                ds_utimes = np.array([utime_rounder(elem) for elem in ds_utimes])

                #Loops through each transit and tests to see if it was false
                for transit in transits:
                    idx = transit.beg 

                    #Find the desired_setpoints utime which represents that resolve_no_forward_progress_timeout seconds have passed since the beginning of the transit
                    beg_idx = idx #Beginning index of the transit
                    last_idx = idx #Index resolve_no_forward_progress_timeout seconds after the transit began
                    while ds_utimes[last_idx] < ds_utimes[idx] + resolve_no_forward_progress_timeout:
                        last_idx += 1
                    
                    #Get the first index of utimes such that utimes[i] == ds_utimes[idx] (Convert indices from ds_utimes into utimes)
                    bot_idx = np.where(np.isclose(utimes, ds_utimes[beg_idx], rtol=0, atol=1))[0][0]
                    last_bot_idx = np.where(np.isclose(utimes, ds_utimes[last_idx], rtol=0, atol=1))[0][0]

                    prev_pitch = pitches[bot_idx] #Pitch at beginning of the transit
                    last_pitch = pitches[last_bot_idx] #Pitch resolve_no_forward_progress_timeout secs later

                    prev_desired_speed = desired_speeds[beg_idx] #Desired speed at beginning of the transit
                    last_desired_speed = desired_speeds[last_idx] #Desired speed resolve_no_forward_progress_timeout secs later
          
                    #If the actual pitch > threshold pitch, desired speed > threshold speed, and time passed > threshold for timeout, then false transit is detected
                    if prev_pitch >= resolve_pitch_threshold and last_pitch >= resolve_pitch_threshold and prev_desired_speed > resolve_desired_speed_threshold and last_desired_speed > resolve_desired_speed_threshold:
                            start_time = utime_to_realtime(ds_utimes[beg_idx])
                            end_time = utime_to_realtime(ds_utimes[last_idx])
                            false_transits.append(FalseTransit(transit.beg, transit.end, start_time, end_time))
                
                #Print out transit data for each bot
                num_transits = len(transits)
                num_false_transits = len(false_transits)
                
                if num_false_transits != 0:
                    print(f'Num transits: {num_transits}, Num false transits: {num_false_transits}, False Transit Rate: {num_false_transits / num_transits * 100:.2f}%')
                    print("     False Transit time(s): ")
                    for transit in false_transits:
                        print('      ', transit.start_time, ' - ', transit.end_time)
                        print()
                    print()
                else:
                    print("NO FALSE TRANSITS DETECTED")
                    print(f'{num_transits} transits completed\n')

    if not has_h5:
        print(f'No .h5 files found in {directory_path}')
        
def main():
    #Default analysis parameters
    global resolve_pitch_threshold #Degrees (90 = vertical)
    global resolve_desired_speed_threshold #m/s
    global resolve_no_forward_progress_timeout #Seconds

    resolve_pitch_threshold = 75
    resolve_desired_speed_threshold = 0 
    resolve_no_forward_progress_timeout = 15 

    #Logic for user input analysis parameters (pitch, desired speed, timeout)
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