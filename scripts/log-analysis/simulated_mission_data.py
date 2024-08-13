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

    for filename in file_list:
        with h5py.File(filename, 'r') as file:
            #print(filename)
            groups = file.keys()

            # Groups we're interested in
            task_pattern = re.compile(r'jaiabot::task_packet;.')
            status_pattern = re.compile(r'jaiabot::bot_status;.')

            # str_filename = str(filename).split('_')
            # instance_fleet_number = str_filename[-2][5:]

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

                bot_lat = pd.Series(file['goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lat'], name='bot_lat')
                bot_long = pd.Series(file['goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/location/lon'], name='bot_long')

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
                
                # first_transit_index = np.where(mission_state == 110)[0][0]
                # last_stop_index = np.where(mission_state == 142)[-1][-1]
                start_idx = np.where(mission_state == 110)[0][0]
                end_idx = np.where(mission_state == 142)[-1][-1]

                status_utime = status_utime - status_utime[start_idx]
                # status_datetime = pd.to_datetime(status_utime, unit='us', origin='unix', utc=True).dt.tz_convert('America/New_York')
                # status_datetime = pd.to_datetime(status_utime, unit='us', origin='unix', utc=True)

                status_datetime = pd.to_datetime(status_utime, unit='us', origin='unix', utc=True)
                status_datetime.name = 'Date/Time'

                status_datetime = status_datetime.astype(str)

                for i in range(len(status_datetime)):
                    status_datetime[i] = status_datetime[i][11:19]
                # print(status_datetime)
                
                instances = pd.concat([bot_id[start_idx:end_idx], status_roll[start_idx:end_idx], status_pitch[start_idx:end_idx], status_yaw[start_idx:end_idx], bot_lat[start_idx:end_idx], bot_long[start_idx:end_idx], status_depth[start_idx:end_idx], mission_state[start_idx:end_idx], status_datetime[start_idx:end_idx]], axis=1)
                
                bot_data[max(bot_id)] = instances

                # instance_start_time = str(status_datetime[0])[0:-16]
                # instance_end_time = str(status_datetime[len(status_datetime)-1])[0:-16]

                
            except IOError as e:
                file.close()
                print(f"Error {e}")
                continue

    return bot_data

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

def export_data(bot_data, out_path="..\\..\\..\\..\\test.xlsx"):    

    # with pd.ExcelWriter(out_path, mode='a', if_sheet_exists='overlay') as writer: 
    with pd.ExcelWriter(out_path, mode='w') as writer: 
        
        for key in bot_data:
            bot_data[key].to_excel(writer, sheet_name='Bot ' + str(key))


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
    bot_data = get_data(file_list)

    export_data(bot_data)


if __name__ == '__main__':
    main()