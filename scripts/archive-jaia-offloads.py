#!/usr/bin/env python3

import glob
import zipfile
import logging
import argparse
import os

from pprint import pprint
from typing import Dict


def get_file_lists():
    '''Returns a dictionary indexing archive names to lists of files to put into them'''

    filenames_per_archive: Dict[str, str] = {}

    for fn in glob.glob(f'{args.source_dir}/*'):
        try:
            parts = fn.split('_')
            year = parts[-1][:4]
            month = parts[-1][4:6]
            archive_name = f'{year}-{month}'

            filenames_per_archive.setdefault(archive_name, []).append(fn)

        except IndexError:
            logging.warning(f'No date in filename: {fn}')

    return filenames_per_archive


def create_archives(file_lists: Dict[str, str]):
    os.makedirs(args.dest_dir, exist_ok=True)

    for archive_name in file_lists:
        zip_name = f'{args.dest_dir}/{archive_name}.zip'

        logging.info(f'Creating archive: {zip_name}')

        if args.remove_older is not None:
            should_delete_files = archive_name < args.remove_older
        else:
            should_delete_files = False

        if should_delete_files:
            logging.warning(f'Removing log files after archiving for {zip_name}')

        with zipfile.ZipFile(zip_name, 'a', compression=zipfile.ZIP_DEFLATED, strict_timestamps=False) as zip_file:
            skip_count = 0
            added_count = 0
            deleted_count = 0

            for file_name in file_lists[archive_name]:

                path_in_zipfile = os.path.basename(file_name)

                if zipfile.Path(zip_file, path_in_zipfile).exists():
                    skip_count += 1
                    logging.debug(f'  File already exists in archive: {path_in_zipfile}')
                    continue

                zip_file.write(file_name, os.path.basename(file_name))
                added_count += 1

            # Delete the files all in one go
            if should_delete_files:
                for file_name in file_lists[archive_name]:
                    os.remove(file_name)
                    deleted_count += 1

        logging.info(f'  Files added: {added_count}, skipped: {skip_count}, deleted: {deleted_count}')
    

if __name__ == '__main__':
    # Command-line arguments
    parser = argparse.ArgumentParser(description='Archive and optionally purge bot_offload files', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('-s', '--source', dest='source_dir', default='/var/log/jaiabot/bot_offload', help='Source path of log files')
    parser.add_argument('-d', '--dest', dest='dest_dir', default=os.path.expanduser('~/bot_offload_archive'), help='Destination directory for archives')
    parser.add_argument('-r', '--remove-older', dest='remove_older', help='Remove logs from before YYYY-MM')

    args = parser.parse_args()


    logging.basicConfig(level=logging.INFO)

    file_lists = get_file_lists()
    create_archives(file_lists)
