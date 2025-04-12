import analysis_utils as au
import argparse

from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Search for .h5 files in a directory or validate a specific .h5 file.')
    parser.add_argument('path', type=Path, help='Path to directory or file to search')
    parser.add_argument('-r', '--recursive', action='store_true', help='Search recursively through subdirectories')
    args = parser.parse_args()

    # Get all h5 files in the logs directory
    h5_files = au.get_h5_files(args.path, args.recursive)

    # Get the current data
    for h5_file in h5_files:
        print(h5_file)
        df_list = []
        try:
            with au.open_h5_file(h5_file) as f:
                ph_data = au.get_ph_data(f)
                ec_data = au.get_ec_data(f)
                do_data = au.get_do_data(f)

                df_list.append(ph_data)
                df_list.append(ec_data)
                df_list.append(do_data)

                combined_df = au.combine_data(df_list)
                combined_df['datetime'] = au.utime_to_datetime(combined_df, 'utime')
                au.plot_2_series(combined_df, x_axis='datetime', y_axis=['ph', 'ec', 'do'], title='PH, EC, DO', x_label='Time', y_label='PH')
                # au.plot_2_series(combined_df, x_axis='datetime', y_axis='ec', title='EC', x_label='Time', y_label='EC')
                # au.plot_2_series(combined_df, x_axis='datetime', y_axis='do', title='DO', x_label='Time', y_label='DO')

                # print(combined_df)

                for i in range(len(combined_df.columns)-1):
                    print(combined_df.columns[i])
                    print(f"Time Range: {combined_df['datetime'].min()} - {combined_df['datetime'].max()}")
                    print(f"Max: {au.get_max_value(combined_df, combined_df.columns[i])}")
                    print(f"Min: {au.get_min_value(combined_df, combined_df.columns[i])}")
                    print(f"Mean: {au.get_mean_value(combined_df, combined_df.columns[i])}")
                    print(f"Median: {au.get_median_value(combined_df, combined_df.columns[i])}")
                    print(f"Mode: {au.get_mode_value(combined_df, combined_df.columns[i])}")
                    print(f"Std Dev: {au.get_std_dev_value(combined_df, combined_df.columns[i])}")
                    print("\n")
        except Exception as e:
            print(f"Error processing {h5_file}: {e}")



if __name__ == "__main__":
    main()