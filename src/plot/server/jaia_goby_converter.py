#!/usr/bin/env python3

'''This script watches a directory for changes, and runs goby_log_tool to convert any new .goby files to .h5 files'''

import argparse
import logging
import os
from posixpath import islink
import time
import glob

parser = argparse.ArgumentParser()
parser.add_argument('-d', dest="path", type=str, default="/var/log/jaiabot/bot_offload", help="Path to monitor for new goby files to convert")
parser.add_argument("-l", dest='logLevel', type=str, default='INFO', help="Logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
parser.add_argument('-s', dest='size_limit', type=int, default='50000000', help='Maximum goby file size to convert')
args = parser.parse_args()

# Setup log level
logLevel = getattr(logging, args.logLevel.upper())
logging.basicConfig(level=logLevel)

# Monitor for changes
path = os.path.expanduser(args.path)
logging.info(f'Monitoring path: {path}')

old_mtime = 0

while True:
    mtime = os.path.getmtime(path)
    if mtime != old_mtime:
        # Get all goby files
        goby_files = glob.glob(f'{path}/**/*.goby', recursive=True)
        goby_file_bodies = set([goby_file[:-5] for goby_file in goby_files])

        # Get all h5 files
        h5_files = set(glob.glob(f'{path}/**/*.h5', recursive=True))
        h5_file_bodies = set([h5_file[:-3] for h5_file in h5_files])

        # Get difference
        required_file_bodies = goby_file_bodies - h5_file_bodies

        if len(required_file_bodies) > 0:
            logging.info(f'New files to convert: {required_file_bodies}')
            for body in required_file_bodies:
                goby_filename = body + '.goby'

                try:
                    # Skip symlinks
                    if os.path.islink(goby_filename):
                        logging.info(f'Skipping symlink {goby_filename}')
                        continue

                    # Skip giant files
                    file_size = os.path.getsize(goby_filename)
                    if file_size > args.size_limit:
                        logging.warning(f'Skipping file {goby_filename}, due to large size ({file_size} > {args.size_limit})')
                        continue

                    # Convert
                    cmd = f'goby_log_tool --input_file {goby_filename} --output_file {body}.h5 --format HDF5'
                    logging.info(cmd)
                    os.system(cmd)

                except FileNotFoundError:
                    logging.warning(f'File not found: {goby_filename}')
                    continue

        old_mtime = mtime

    time.sleep(5)
