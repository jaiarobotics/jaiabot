#!/usr/bin/env python3

"""Removes all library files older than the most recently-built githashed versions."""

import glob
import os

jaia_root = os.path.realpath(os.path.dirname(__file__) + '/../..')

files_removed = 0

for lib_path in glob.glob(jaia_root + '/build/*/lib'):
    files = list(filter(os.path.isfile, glob.glob(lib_path + '/*')))
    files.sort(key=os.path.getmtime, reverse=True)

    hashes = [f.split('+')[-1] for f in files if '+' in f]
    if not hashes:
        print(f'No hashed library files in {lib_path}')
        continue

    latest_hash = hashes[0]
    for library_file in files:
        if '+' in library_file and library_file.split('+')[-1] != latest_hash:
            os.remove(library_file)
            print(f'Removed file {library_file}')
            files_removed += 1

print(f'Deleted {files_removed} old library file(s)')
