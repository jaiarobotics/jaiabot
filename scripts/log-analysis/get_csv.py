import analysis_utils as au
import argparse
import pandas as pd

from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='Search for .h5 files in a directory or validate a specific .h5 file.')
    parser.add_argument('path', type=Path, help='Path to directory or file to search')
    parser.add_argument('-o', '--output_path', type=Path, required=False, help='Path to directory or file to search')
    parser.add_argument('-r', '--recursive', action='store_true', help='Search recursively through subdirectories')
    args = parser.parse_args()

    # Save combined dataframes to CSV
    if args.output_path != None:
        output_dir = Path(f"{args.output_path}")
        output_dir.mkdir(exist_ok=True)

    # Get all h5 files in the logs directory
    h5_files = au.get_h5_files(args.path, args.recursive)

    df_taskpacket_list = []

    # Get the current data
    for h5_file in h5_files:
        print(h5_file)
        df_list = []
        try:
            with au.open_h5_file(h5_file) as f:               
                taskpacket_data = au.get_taskpacket_data(f)
                df_list.append(taskpacket_data)

                combined_df = au.combine_data(df_list)
                combined_df['datetime'] = au.utime_to_datetime(combined_df, 'utime')

                if args.output_path != None:
                    combined_df.to_csv(output_dir / f"{h5_file.stem}.csv", index=False)
            
                df_taskpacket_list.append(combined_df)

                if args.output_path != None:
                    df_taskpacket.to_csv(output_dir / f"{h5_file.stem}_taskpacket.csv", index=False)

                    print("Saved combined data to:")
                    print(output_dir / f"{h5_file.stem}_taskpacket.csv")

        except Exception as e:
            print(f"Error processing {h5_file}: {e}")

    df_taskpacket = au.combine_data(df_taskpacket_list)
    df_taskpacket['datetime'] = au.utime_to_datetime(df_taskpacket, 'utime')

    print(df_taskpacket.columns)
    if args.output_path != None:
        df_taskpacket.to_csv(output_dir / "combined_taskpacket.csv", index=False)

    print("Saved combined data to:")
    print(output_dir / "combined_taskpacket.csv")


if __name__ == "__main__":
    main()
