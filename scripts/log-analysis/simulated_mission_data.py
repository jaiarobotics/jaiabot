import pandas as pd 
import numpy as np
import h5py
import argparse
import os
import sys
import re

from pathlib import Path
from datetime import datetime
# import sortedcontainers
from sortedcontainers import SortedDict
import math

"""

Usage:
- Navigate to the directory this script is saved in.
- In a terminal, run python3 simulated_mission_data.py <path/to/h5>.
    - If given a .h5 it will run one file, if given a directory it will run through all files in the directory. 
- Add <-r> as a flag to run a recursive search through subdirectories. 


"""



MICRO_FACTOR = 1_000_000

def get_data(file_list):

    bot_data = SortedDict({})
    bot_first_coordinates = SortedDict({})

    for filename in file_list:
        with h5py.File(filename, 'r') as file:
            #print(filename)
            groups = file.keys()

            # Groups we're interested in
            task_pattern = re.compile(r'jaiabot::task_packet;.')
            status_pattern = re.compile(r'jaiabot::bot_status;.')

            try:
                for group in groups:
                    if task_pattern.search(group):
                        task_packet = file[group]
                    elif status_pattern.search(group):
                        bot_status = file[group]

                # Bot Status Data
                try:
                    status_utime_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/_utime_'], name='status_utime')
                except:
                    continue
                bot_id_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/bot_id'], name='bot_number')
                mission_state_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/mission_state'], name='mission_state')
                status_scheme = pd.Series(bot_status['jaiabot.protobuf.BotStatus/_scheme_'], name='status_scheme')

                status_pitch_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/attitude/pitch'], name='status_pitch')
                status_yaw_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/attitude/heading'], name='status_yaw')
                status_roll_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/attitude/roll'], name='status_roll')

                status_depth_unfiltered = pd.Series(bot_status['jaiabot.protobuf.BotStatus/depth'], name='status_depth')

                bot_lat = pd.Series(file['goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lat'], name='bot_lat_in_meters')
                bot_long = pd.Series(file['goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lon'], name='bot_long_in_meters')

                bot_lat.reset_index(drop=True, inplace=True)
                bot_long.reset_index(drop=True, inplace=True)

                status_utime = status_utime_unfiltered[status_scheme != 1]
                bot_id = bot_id_unfiltered[status_scheme != 1]
                mission_state = mission_state_unfiltered[status_scheme != 1]
                status_pitch = status_pitch_unfiltered[status_scheme != 1]
                status_yaw = status_yaw_unfiltered[status_scheme != 1]
                status_roll = status_roll_unfiltered[status_scheme != 1]
                status_depth = status_depth_unfiltered[status_scheme != 1]

                status_utime.reset_index(drop=True, inplace=True)
                bot_id.reset_index(drop=True, inplace=True)
                mission_state.reset_index(drop=True, inplace=True)
                status_pitch.reset_index(drop=True, inplace=True)
                status_yaw.reset_index(drop=True, inplace=True)
                status_roll.reset_index(drop=True, inplace=True)
                status_depth.reset_index(drop=True, inplace=True)
                
                start_idx = np.where(mission_state == 110)[0][0]
                end_idx = np.where(mission_state == 142)[-1][-1]

                status_utime = status_utime - status_utime[start_idx]
                status_datetime = pd.to_datetime(status_utime, unit='us', origin='unix', utc=True)
                status_datetime.name = 'Date/Time'

                status_datetime = status_datetime.astype(str)

                for i in range(len(status_datetime)):
                    status_datetime[i] = status_datetime[i][11:19]


                # print(mission_state.unique())
                """
                Mission state status_pitch classification: 
                90 degrees:

                123
                124
                125
                126
                128

                81 degrees:
                114
                121
                129
                141
                142
                150?
                160?
                161
                162?
                163


                9 degrees:
                100?
                110
                112?
                113?
                120?
                130?
                131
                140
                141

                0 degrees:

                N/A:
                0
                1
                2
                3
                4
                5
                200
                202
                203
                204
                205
                """

                deg_90 = [123, 124, 125, 126, 128]
                deg_81 = [129, 142]
                deg_9 = [110]



                # issues = pd.Series()

                for i in range(len(mission_state)):
                    if mission_state[i] in deg_90 and status_pitch[i] != 85:
                        # issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                        status_pitch[i] = 85
                    if mission_state[i] in deg_81 and status_pitch[i] != 85:
                        # issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                        status_pitch[i] = 85
                    if mission_state[i] in deg_9 and status_pitch[i] != 0:
                        # issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                        status_pitch[i] = 0

                # for i in range(len(mission_state)):
                #     if mission_state[i] in deg_90 and status_pitch[i] != 85:
                #         issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                #         # status_pitch[i] = 85
                #     if mission_state[i] in deg_81 and status_pitch[i] != 85:
                #         issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                #         # status_pitch[i] = 85
                #     if mission_state[i] in deg_9 and status_pitch[i] != 0:
                #         issues[len(issues)-1] = "State: " + str(mission_state[i]) + "  Pitch: " + str(status_pitch[i])
                #         # status_pitch[i] = 0
                
                # print(issues.unique())

                

                bot_lat_in_meters = bot_lat.copy()
                bot_long_in_meters = bot_long.copy()

                first_lat = bot_lat[start_idx].copy()
                first_long = bot_long[start_idx].copy()

                lat_to_m_conversion = 111.32 * 1000
                long_to_m_conversion = 40075 * 1000 / 360

                is_sim_data = False

                for i in range(len(bot_lat_in_meters)):
                    bot_lat_in_meters[i] = (bot_lat[i] - first_lat) * lat_to_m_conversion
                    lat_mid = (bot_lat[i] + first_lat) / 2
                    bot_long_in_meters[i] = (bot_long[i] - first_long) * long_to_m_conversion * math.cos(lat_mid)
                
                for i in range(1, len(bot_lat_in_meters)):
                    if abs(bot_lat_in_meters[i] - bot_lat_in_meters[i-1]) > 1000:
                        for j in range(i+1, len(bot_lat_in_meters)):
                            bot_lat_in_meters[j] = bot_lat_in_meters[j] - bot_lat_in_meters[i] + bot_lat_in_meters[i-1]
                            bot_long_in_meters[j] = bot_long_in_meters[j] - bot_long_in_meters[i] + bot_long_in_meters[i-1]
                        bot_lat_in_meters[i] = bot_lat_in_meters[i-1]
                        bot_long_in_meters[i] = bot_long_in_meters[i-1]

                begin_dive_indices = np.where((mission_state >= 123) & (mission_state <= 129))[0]
                for i in begin_dive_indices:
                    if status_pitch[i-1] == 0 and status_pitch[i] == 85:
                        is_sim_data = True
                        status_pitch[i-1] = 65
                        status_pitch[i-2] = 45
                        status_pitch[i-3] = 30
                        status_pitch[i-4] = 15
                        status_pitch[i-5] = 5

                end_dive_indices = np.where((mission_state >= 123) & (mission_state <= 129))[0]
                for i in end_dive_indices:
                    if mission_state[i+1] == 110 and status_depth[i] == 0 and status_pitch[i-1] == 85:
                        is_sim_data = True
                        status_pitch[i] = 65
                        status_pitch[i+1] = 45
                        status_pitch[i+2] = 30
                        status_pitch[i+3] = 15
                        status_pitch[i+4] = 5

                # if is_sim_data:
                #     instances = pd.concat([bot_id[start_idx:end_idx], status_pitch[start_idx:end_idx], status_yaw[start_idx:end_idx], bot_lat[start_idx:end_idx], bot_long[start_idx:end_idx], bot_lat_in_meters[start_idx:end_idx], bot_long_in_meters[start_idx:end_idx], status_depth[start_idx:end_idx], mission_state[start_idx:end_idx], status_datetime[start_idx:end_idx]], axis=1)
                # else:
                #     instances = pd.concat([bot_id[start_idx:end_idx], status_roll[start_idx:end_idx], status_pitch[start_idx:end_idx], status_yaw[start_idx:end_idx], bot_lat[start_idx:end_idx], bot_long[start_idx:end_idx], bot_lat_in_meters[start_idx:end_idx], bot_long_in_meters[start_idx:end_idx], status_depth[start_idx:end_idx], mission_state[start_idx:end_idx], status_datetime[start_idx:end_idx]], axis=1)
                instances = pd.concat([bot_id[start_idx:end_idx], status_pitch[start_idx:end_idx], status_yaw[start_idx:end_idx], bot_lat[start_idx:end_idx], bot_long[start_idx:end_idx], bot_lat_in_meters[start_idx:end_idx], bot_long_in_meters[start_idx:end_idx], status_depth[start_idx:end_idx], mission_state[start_idx:end_idx], status_datetime[start_idx:end_idx]], axis=1)
                instances.reset_index(drop=True, inplace=True)
                instances.index += 1

                bot_data[max(bot_id)] = instances
                bot_first_coordinates[max(bot_id)] = '(' + str(round(first_lat, 7)) + ',' + str(round(first_long, 7)) + ')'

                
            except IOError as e:
                file.close()
                print(f"Error {e}")
                continue

    return bot_data, bot_first_coordinates

def get_files(path, recursive):
    if os.path.isdir(path):
        if recursive:
            return list(Path(path).rglob('*.h5'))
        else:
            return list(Path(path).glob('*.h5'))
    elif os.path.isfile(path) and path.endswith('.h5'):
        return [path]
    else:
        print("File or Directory does not exist or File is not an h5. Try again.")

def export_data(bot_data, bot_first_coordinates, out_path="Simulated_Mission_Data.xlsx"):    

    # with pd.ExcelWriter(out_path, mode='a', if_sheet_exists='overlay') as writer: 
    with pd.ExcelWriter(out_path, mode='w') as writer: 
        
        for key in bot_data:
            bot_data[key].to_excel(writer, sheet_name='Bot ' + str(key) + ' ' + bot_first_coordinates[key])


        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            
            for col in worksheet.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try: # Necessary to avoid error on empty cells
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2) * 1.2
                worksheet.column_dimensions[column].width = adjusted_width
            

def add_blank_rows(df, no_rows):
    for i in range(no_rows):
        df.loc[len(df), df.columns] = pd.Series(' ', index=range(len(df.columns)))


def main():

    parser = argparse.ArgumentParser(description='Dynamically allow users to parse through a series of datafiles.')
    parser.add_argument("file_path", type=str, help="Path to directory .h5 file.")
    parser.add_argument("-r", "--recursive", action="store_true", help="Recursively find all .h5 files in a directory and all of its subdirectories.")
    args = parser.parse_args()

    file_list = get_files(args.file_path, args.recursive)
    bot_data, bot_first_coordinates = get_data(file_list)

    export_data(bot_data, bot_first_coordinates)


if __name__ == '__main__':
    main()
