import argparse

import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import analysis_utils

from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Search for .h5 files in a directory or validate a specific .h5 file.')
    parser.add_argument('path', type=Path, help='Path to directory or file to search')
    parser.add_argument('-r', '--recursive', action='store_true', help='Search recursively through subdirectories')
    
    args = parser.parse_args()

    # List of h5 files to process
    h5_files = analysis_utils.get_h5_files(args.path, args.recursive)

    for file in h5_files:
        print(file)
        df_list = []
        with analysis_utils.open_h5_file(file) as h5_file:
            current = analysis_utils.get_current_data(h5_file)
            rpm = analysis_utils.get_RPM_data(h5_file)
            speed = analysis_utils.get_speedOverGround_data(h5_file)

            df_list.append(current)
            df_list.append(rpm)
            df_list.append(speed)

        combined_df = analysis_utils.combine_data(df_list)

        print(current)
        print(rpm)
        print(speed)

        print(combined_df)
 
        print(f"Max Current: {analysis_utils.get_max_value(combined_df, 'current')}")
        print(f"Min Current: {analysis_utils.get_min_value(combined_df, 'current')}")
        print(f"Mean Current: {analysis_utils.get_mean_value(combined_df, 'current')}")
        print(f"Median Current: {analysis_utils.get_median_value(combined_df, 'current')}")
        print(f"Std Dev Current: {analysis_utils.get_std_dev_value(combined_df, 'current')}\n")

        print(f"Max RPM: {analysis_utils.get_max_value(combined_df, 'rpm')}")
        print(f"Min RPM: {analysis_utils.get_min_value(combined_df, 'rpm')}")
        print(f"Mean RPM: {analysis_utils.get_mean_value(combined_df, 'rpm')}")
        print(f"Median RPM: {analysis_utils.get_median_value(combined_df, 'rpm')}")
        print(f"Std Dev RPM: {analysis_utils.get_std_dev_value(combined_df, 'rpm')}\n")

        print(f"Max Speed: {analysis_utils.get_max_value(combined_df, 'speed')}")
        print(f"Min Speed: {analysis_utils.get_min_value(combined_df, 'speed')}")
        print(f"Mean Speed: {analysis_utils.get_mean_value(combined_df, 'speed')}")
        print(f"Median Speed: {analysis_utils.get_median_value(combined_df, 'speed')}")
        print(f"Std Dev Speed: {analysis_utils.get_std_dev_value(combined_df, 'speed')}\n")
        
        

        fig = analysis_utils.plot_series_x_time(combined_df, 'current', title=file.name)
        fig.show()


if __name__ == "__main__":
    main()