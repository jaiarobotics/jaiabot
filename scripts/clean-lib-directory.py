#!/usr/bin/env python3

import glob
import os

"""Removes all library files older than the most recently-build githashed versions.
"""

if __name__ == '__main__':
    filesRemoved = 0

    for libPath in glob.glob('../build/*/lib'):
        files = list(filter(os.path.isfile, glob.glob(libPath + "/*")))
        files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        
        latestLibraryHash = None
        for libraryFile in files:
            parts = libraryFile.split('+')
            if len(parts) > 1:
                latestLibraryHash = parts[-1]
                break

        if latestLibraryHash is None:
            print(f'No hashed library files in {libPath}')
            continue
        
        # Delete all library files with a hash different from the latest one
        for libraryFile in files:
            parts = libraryFile.split('+')
            if len(parts) > 1:
                thisLibraryHash = parts[-1]
                if thisLibraryHash != latestLibraryHash:
                    os.remove(libraryFile)
                    print(f'Removed file {libraryFile}')
                    filesRemoved += 1

print(f'Deleted {filesRemoved} old library file(s)')
