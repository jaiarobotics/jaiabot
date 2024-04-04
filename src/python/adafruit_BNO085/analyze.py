#!/usr/bin/env python3

import h5py
from pyjaia.series import *
import os
from typing import Callable
import numpy
import math
from datetime import timedelta, datetime
import sys
from typing import *
from math import *
from waves.processing import *
from waves.filters import *
from pathlib import *
from statistics import *
import spectrogram
from waves.series_set import *
from analysis_html import *

### Global settings ##
sampleFreq = 4


def shouldInclude(missionStateIndex: int, seriesSet: "SeriesSet"):
    """Returns true if this data point should be included in analysis.

    Args:
        missionStateIndex (int): Index into the missionState Series.
        seriesSet (SeriesSet): The series set to check.

    Returns:
        bool: Return true if the data at this time should be included in the anlysis.
    """

    if not isInDriftState(missionStateIndex, seriesSet):
        return False

    blacklist = [
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 2, 48, 20), datetime(2024, 2, 14, 2, 58, 51)),
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 4, 8, 0), datetime(2024, 2, 14, 4, 18, 55)),
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 3, 1, 39), datetime(2024, 2, 14, 3, 3, 31)),        
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 3, 7, 30), datetime(2024, 2, 14, 3, 9, 18)),
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 4, 36, 32), datetime(2024, 2, 14, 4, 40, 0)),
        TimeRange.fromDatetimes(datetime(2024, 2, 14, 4, 40, 0), datetime(2024, 2, 14, 6, 14, 0)),
        TimeRange.fromDatetimes(datetime(2024, 2, 13, 7, 18, 39), datetime(2024, 2, 13, 7, 25, 46)),
    ]

    utime = seriesSet.missionState.utime[missionStateIndex]
    for timeRange in blacklist:
        if utime in timeRange:
            # In a blacklisted TimeRange
            return False
        
    return True

######################

cssTag = '<style>' + open('style.css').read() + '</style>'


def filterAndPlot(h5FilePath: Path, drifts: List[SeriesSet]):
    h5FilePath = Path(h5FilePath)
    description = h5FilePath.stem
    htmlFilePath = h5FilePath.parent.joinpath(f'waveAnalysis-{description}-{datetime.now().strftime("%Y%m%dT%H%M%S")}.html')
    htmlFilename = str(htmlFilePath)
    SWHs = []


    uniformAcceleration: List[Series] = [drift.accelerationVertical.makeUniform(sampleFreq) for drift in drifts]

    with open(htmlFilename, 'w') as f:
        f.write('<html><meta charset="utf-8">\n')

        f.write(cssTag)
        f.write(f'<h1>{description}</h1>')
        f.write(htmlForSummaryTable(uniformAcceleration))

        f.write(htmlForFilterGraph(bandPassFilter))

        # Drift altitude and filtered altitude series
        for driftIndex, drift in enumerate(drifts):
            f.write(htmlForDrift(driftIndex, drift))

        f.write('</html>\n')

    os.system(f'xdg-open {htmlFilename}')


def doAnalysis(h5File: h5py.File):
    seriesSet = SeriesSet.loadFromH5File(h5File)
    drifts = seriesSet.split(shouldInclude)

    filterAndPlot(h5File.filename, drifts)

    # sampleFreq = 4
    # uniformAccelerationSeries = getUniformSeries(freq=sampleFreq)(accelerationSeries)
    # bandPassFilter = gaussianFilter(0.1, 2.0, k=1000)
    # bandPassFilter = cos2Filter(1/30, 1/5, 0.02)
    # filterAndPlot(Path(h5File.filename), uniformAccelerationSeries, otherSeriesList=otherSeriesList, sampleFreq=sampleFreq, splitFunc=splitFunc, bandPassFilter=bandPassFilter)


if __name__ == '__main__':
    for h5Path in sys.argv[1:]:
        h5File = h5py.File(h5Path)
        doAnalysis(h5File)

