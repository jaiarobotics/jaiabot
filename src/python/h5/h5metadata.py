#!/usr/bin/env python3

import h5py
import objects
import argparse

from pprint import *
from datetime import *


parser = argparse.ArgumentParser(description='Lists metadata from a JaiaH5 file')
parser.add_argument('jaiah5_path')
args = parser.parse_args()


jaia_h5 = h5py.File(args.jaiah5_path)

metadataGroup = jaia_h5['jaiabot::metadata/jaiabot.protobuf.DeviceMetadata']
metadataList = objects.jaialog_get_object_list(metadataGroup, repeated_members=[])


for metadata in metadataList:
    pprint(metadata)
    print()
