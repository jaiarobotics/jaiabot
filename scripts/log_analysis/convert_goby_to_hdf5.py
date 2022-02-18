#!/usr/bin/env python3

from pathlib import Path
import sys
import os


def process_goby_to_hdf5(goby_filename):
    goby_path = Path(goby_filename)
    h5_path = Path(goby_path.parent, goby_path.stem + '.h5')

    if not h5_path.is_file():
        cmd = f'goby_log_tool --input_file {goby_path.absolute()} --output_file {h5_path.absolute()} --format HDF5'
        print('  > ', cmd)
        os.system(cmd)

    return h5_path.absolute()


for goby_filename in sys.argv[1:]:
    process_goby_to_hdf5(goby_filename)

