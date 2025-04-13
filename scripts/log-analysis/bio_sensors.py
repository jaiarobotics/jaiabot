import analysis_utils as au
import argparse
import pandas as pd

from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Search for .h5 files in a directory or validate a specific .h5 file.')
    parser.add_argument('path', type=Path, help='Path to directory or file to search')
    parser.add_argument('-o', '--output_path', type=Path, help='Path to directory or file to search')
    parser.add_argument('-r', '--recursive', action='store_true', help='Search recursively through subdirectories')
    args = parser.parse_args()

    # Save combined dataframes to CSV
    output_dir = Path(f"{args.output_path}/combined_output")
    output_dir.mkdir(exist_ok=True)

    # Get all h5 files in the logs directory
    h5_files = au.get_h5_files(args.path, args.recursive)

    df_ec_list = []
    df_do_list = []  
    df_ph_list = []

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

                df_ph_list.append(ph_data)
                df_ec_list.append(ec_data)
                df_do_list.append(do_data)

                combined_df = au.combine_data(df_list)
                combined_df['datetime'] = au.utime_to_datetime(combined_df, 'utime')
                combined_df.to_csv(output_dir / f"{h5_file.stem}.csv", index=False)
                
                # Plot all sensor series for one file
                au.plot_series_x_utime(combined_df, y_axis=[combined_df.columns[i] for i in range(1, len(combined_df.columns))], title=f"{h5_file.stem}", y_label='Bio Sensor Data')
                
                # Uncomment to plot each sensor series individually
                # au.plot_series_x_utime(combined_df, y_axis=['ph'], title=f"{h5_file.stem} - pH", y_label='pH')
                # au.plot_series_x_utime(combined_df, y_axis=['ec'], title=f"{h5_file.stem} - EC", y_label='EC')
                # au.plot_series_x_utime(combined_df, y_axis=['do'], title=f"{h5_file.stem} - DO", y_label='DO')


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

    df_ec = au.combine_data(df_ec_list)
    df_do = au.combine_data(df_do_list)
    df_ph = au.combine_data(df_ph_list)

    df_ec['datetime'] = au.utime_to_datetime(df_ec, 'utime')
    df_do['datetime'] = au.utime_to_datetime(df_do, 'utime')
    df_ph['datetime'] = au.utime_to_datetime(df_ph, 'utime')

    au.plot_series_x_utime(df_ec, y_axis=[df_ec.columns[i] for i in range(1, len(df_ec.columns))], title='EC', y_label='Conductivity')
    au.plot_series_x_utime(df_do, y_axis=[df_do.columns[i] for i in range(1, len(df_do.columns))], title='DO', y_label='Dissolved Oxygen')
    au.plot_series_x_utime(df_ph, y_axis=[df_ph.columns[i] for i in range(1, len(df_ph.columns))], title='PH', y_label='PH')

    print(df_ec)
    print(df_do)
    print(df_ph)

    df_ec.to_csv(output_dir / "combined_ec.csv", index=False)
    df_do.to_csv(output_dir / "combined_do.csv", index=False)
    df_ph.to_csv(output_dir / "combined_ph.csv", index=False)

    print("Saved combined data to:")
    print(output_dir / "combined_ec.csv")
    print(output_dir / "combined_do.csv")
    print(output_dir / "combined_ph.csv")



if __name__ == "__main__":
    main()