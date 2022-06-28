#!/usr/bin/env python3

import sys
import os
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("age_string", help="Age string of the HDF5 logs you want (Time specifications are interpreted as for the argument to the -d option of GNU date)")
args = parser.parse_args()

def system(cmd):
    print(cmd)
    os.system(cmd)

# Get all remote goby file paths
system(f'ssh jaia@optiplex jaia-logs/convert_goby_to_h5.sh "-{args.age_string}" > files.txt')
system(f'rsync -zaP --files-from=files.txt --no-relative jaia@optiplex:/ ~/jaia-logs/')
system('rm files.txt')
