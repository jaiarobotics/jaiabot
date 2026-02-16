#!/usr/bin/env python3

import pyjaia
from pprint import *


def test_contours():
    # Multiple dives reaching the same depth
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 12, 'lat': 11}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 13, 'lat': 11}, 'depth_achieved': 5}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) == 0

    # Dives in a straight line with varying depths, should get no contours
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 10}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 12, 'lat': 10}, 'depth_achieved': 15}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 13, 'lat': 10}, 'depth_achieved': 20}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) == 0

    # A bunch of dives in the same location with increasing depth, should get no contours
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 6}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 7}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 8}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) == 0

    # A bunch of dives in the same location with same depth
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) == 0

    # A pair of duplicate dives
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 6}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 6}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 11}, 'depth_achieved': 7}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) > 0

    # A pair of duplicate dives, with different depths
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 6}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 11, 'lat': 10}, 'depth_achieved': 6.5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 11}, 'depth_achieved': 7}},
    ]

    result = pyjaia.contours.taskPacketsToColorMap(taskPackets)
    assert len(result['features']) > 0


if __name__ == '__main__':
    test_contours()
