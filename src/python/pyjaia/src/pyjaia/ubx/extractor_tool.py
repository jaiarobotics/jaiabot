#!/usr/bin/env python3

import argparse
import os
import h5py


def main():
    parser = argparse.ArgumentParser(
        description="Extract UBX data from a jaiabot .goby or .h5 log file."
    )
    parser.add_argument(
        "input_file",
        type=str,
        help="Path to the input HDF5 log file.",
    )

    class Args:
        input_file: str

    args: Args = parser.parse_args()

    # If the input file is a .goby file, then use goby log convert to get the .h5 file
    if args.input_file.endswith(".h5"):
        h5_filename = args.input_file
    elif args.input_file.endswith(".goby"):
        h5_filename = args.input_file.rsplit(".", 1)[0] + ".h5"
    else:
        print("Input file must be a .goby or .h5 file.")
        return
    
    # Convert .goby to .h5 if necessary
    if os.path.exists(h5_filename) is False:
        print("Converting .goby file to .h5 format...")
        import subprocess
        subprocess.run(["goby", "log", "convert", "-i", args.input_file, "-o", h5_filename, "--format", "HDF5"], check=True)

    output_filename = args.input_file.rsplit(".", 1)[0] + ".ubx"

    with h5py.File(h5_filename, "r") as h5file:
        if "/jaiabot::ppk/jaiabot.protobuf.UBXChunk/data" not in h5file:
            print(f"No UBX data found in {args.input_file}.")
            return
        
        with open(output_filename, "wb") as ubx_file:
            for chunk_index in range(len(h5file["/jaiabot::ppk/jaiabot.protobuf.UBXChunk/data"])):
                chunk_size = h5file["/jaiabot::ppk/jaiabot.protobuf.UBXChunk/data_size"][chunk_index]
                ubx_chunk = h5file["/jaiabot::ppk/jaiabot.protobuf.UBXChunk/data"][chunk_index][:chunk_size]
                ubx_file.write(ubx_chunk)

    print(f"Extracted UBX data from {args.input_file} to {output_filename}.")


if __name__ == "__main__":
    main()

