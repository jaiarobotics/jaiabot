#!/usr/bin/env python3

import pyjaia
import json
import os
from pprint import *


if __name__ == '__main__':
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 1}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 1.1}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 12, 'lat': 10}, 'depth_achieved': 2}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 13, 'lat': 10}, 'depth_achieved': 3}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 14, 'lat': 10}, 'depth_achieved': 3}},

        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 11}, 'depth_achieved': 1}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 11}, 'depth_achieved': 1.1}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 12, 'lat': 11}, 'depth_achieved': 2}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 13, 'lat': 11}, 'depth_achieved': 3}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 14, 'lat': 11}, 'depth_achieved': 3}},
    ]


    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    json.dump(result, open(os.path.expanduser('~/test_contours.geojson'), 'w'))

