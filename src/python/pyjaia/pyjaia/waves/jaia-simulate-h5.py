#!/usr/bin/env python3

import h5py
import argparse
from pyjaia.waves.series_set import SeriesSet
from jaiabot.messages.mission_pb2 import MissionState
import datetime
import numpy
from math import *
from typing import *
import random
from pyjaia.waves.moskowitz import *


class Config:
    sampleFrequency: float
    N: int


def generateSeriesSet(config: Config):
    seriesSet = SeriesSet()

    t_start = datetime.datetime.now().timestamp() * 1000000


    for i in range(0, config.N):
        utime = int(t_start + i * 1e6 / config.sampleFrequency)

        seriesSet.missionState.append(utime, MissionState.IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT)

        seriesSet.grav_x.append(utime, 0.0)
        seriesSet.grav_y.append(utime, 0.0)
        seriesSet.grav_z.append(utime, -9.8)

        seriesSet.acc_x.append(utime, 0.0)
        seriesSet.acc_y.append(utime, 0.0)
        seriesSet.acc_z.utime.append(utime)

    seriesSet.acc_z.y_values = generateMoscowitz(config.N, config.sampleFrequency)

    return seriesSet


def generateH5(filename: str, config: Config):
    file = h5py.File(filename, mode='w')
    generateSeriesSet(config).writeToH5File(file)
    file.close()


def main():
    parser = argparse.ArgumentParser(description='Generate simulated h5 files for testing.')
    parser.add_argument('-f', '--frequency', type=float, default=4, help='Sampling frequency')
    parser.add_argument('-d', '--duration', type=float, default=120, help='Duration of h5 log to generate (seconds)')
    parser.add_argument('output_filename', type=str, help='Output filename')
    args = parser.parse_args()

    config = Config()
    config.sampleFrequency = args.frequency
    config.N = int(args.duration * config.sampleFrequency)

    generateH5(args.output_filename, config)

if __name__ == '__main__':
    main()
