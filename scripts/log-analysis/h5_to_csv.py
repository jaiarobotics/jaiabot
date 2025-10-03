"""
utime, date and time, Bot_ID, Mission State, Battery Percent, Latitude, Longitude, Depth, and finally any and all water quality parameters (both raw and corrected).

All data should be aligned to a common utime or date and time (I noticed all of the sensors report with a slightly different timestamp (within milliseconds).
"""


import argparse
import os
import sys

import analysis_utils as au
import pandas as pd

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=str, help="The path to the H5 files")
    args = parser.parse_args()

    h5_path = args.path
    h5_files = au.get_h5_files(h5_path)


    for h5_file in h5_files:
        csv_file = h5_file.with_suffix(".csv")
        with au.open_h5_file(h5_file) as f:
            
            # Sensor data
            ec_df = au.get_ec_data(f)
            ph_df = au.get_ph_data(f)
            do_df = au.get_do_data(f)
            fluor_df = au.get_fluor_data(f)
            bar30_df = au.get_bar30_data(f)

            # Vehicle data
            mission_state_df = au.get_mission_state_data(f)
            battery_df = au.get_battery_data(f)
            task_packet_df = au.get_task_packet_data(f)

            df_list = []

            # Check that the data fields are not empty
            if not ph_df.empty:
                df_list.append(ph_df)
            if not do_df.empty:
                df_list.append(do_df)
            if not ec_df.empty:
                df_list.append(ec_df)
            if not mission_state_df.empty:
                df_list.append(mission_state_df)
            if not bar30_df.empty:
                df_list.append(bar30_df)
            if not fluor_df.empty:
                df_list.append(fluor_df)
            if not task_packet_df.empty:
                df_list.append(task_packet_df)

            merged = au.combine_data(df_list, ffill=True)
            merged = au.generate_datetime_column(merged)
            merged.to_csv(csv_file, index=False)

if __name__ == "__main__":
    main() 