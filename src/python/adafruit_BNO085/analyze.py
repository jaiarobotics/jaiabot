#!/usr/bin/env python3

import h5py
from pyjaia.series import *
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
from typing import Callable
import numpy
import math
from datetime import timedelta, datetime
import sys
from typing import *
from math import *
from processing import *
from filters import *
from pathlib import *
from statistics import *
import spectrogram
from seriesSet import *

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

    DRIFT = 121
    if seriesSet.missionState.y_values[missionStateIndex] != DRIFT:
        # Not in a DRIFT state
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

def htmlForWaves(sortedWaveHeights: List[float]):
    html = ''
    html += '<table><tr><td>Wave Heights:</td>'
    minIndexToUse = math.floor(len(sortedWaveHeights) * 2 / 3)
    for index, waveHeight in enumerate(sortedWaveHeights):
        if index >= minIndexToUse:
            html += f'<td class="used">{waveHeight:0.3f}</td>'
        else:
            html += f'<td>{waveHeight:0.3f}</td>'
    html += '</tr></table>'

    return html


def htmlForFilterGraph(filterFunc: Callable[[float], float]):
    # Band pass filter graph
    fig = go.Figure()
    periods = numpy.arange(0.1, 40.0, 0.1)
    y = [filterFunc(1/period) for period in periods]

    fig.add_trace(go.Scatter(x=periods, y=y, name=f'Filter Coefficient'))
    fig.update_layout(
        title=f"Band pass filter",
        xaxis_title="Wave Period (s)",
        yaxis_title="Coefficient",
        legend_title="Legend"
    )

    return '<h1>Band pass filter</h1>' + fig.to_html(full_html=False, include_plotlyjs='cdn')


def htmlForChart(charts: List[Series]):
    htmlString = ''

    fig = make_subplots(specs=[[{"secondary_y": True}]])
    yaxis_titles = []
    for series in charts:
        fig.add_trace(go.Scatter(x=series.datetimes(), y=series.y_values, name=series.name))
        yaxis_titles.append(series.name)

    fig.update_layout(
        xaxis_title="Time",
        yaxis_title=','.join(yaxis_titles),
        legend_title="Legend"
    )

    htmlString += fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='80%', default_height='60%')

    return htmlString


def htmlForDrift(driftIndex: int, drift: SeriesSet):
    # Calculate filtered acceleration series, elevation series, and wave heights
    uniformAcceleration = drift.accelerationVertical.makeUniform(sampleFreq)
    filteredAccelerationSeries = filterAcceleration(uniformAcceleration, sampleFreq)
    filteredAccelerationSeries.name = 'Filtered acceleration'

    elevationSeries = calculateElevationSeries(uniformAcceleration, sampleFreq)
    elevationSeries.name = 'Calculated Elevation'
    waveHeights = calculateSortedWaveHeights(elevationSeries)

    # Header
    htmlString = ''

    htmlString += f'<h1><a id="{driftIndex + 1}">Drift #{driftIndex + 1}</a></h1>'
    durationString = formatTimeDelta(drift.acc_x.duration())
    htmlString += f'<h3>Drift duration: {durationString}<h3>'

    if len(waveHeights) > 0:
        swh = statistics.mean(waveHeights[floor(len(waveHeights)*2/3):])
        htmlString += f'<h3>Significant Wave Height: {swh:0.2f}<h3>'

    # The wave heights
    htmlString += htmlForWaves(waveHeights)

    htmlString += htmlForChart([uniformAcceleration, filteredAccelerationSeries, elevationSeries])
    htmlString += htmlForChart([drift.grav_x])
    grav_x_uniform = drift.grav_x.makeUniform(sampleFreq)
    htmlString += spectrogram.htmlForSpectrogram(grav_x_uniform, fftWindowSeconds=80)
    htmlString += spectrogram.htmlForSpectrogram(uniformAcceleration, fftWindowSeconds=80)
    htmlString += spectrogram.htmlForSpectrogram(filteredAccelerationSeries, fftWindowSeconds=80)

    return htmlString


def htmlForSummaryTable(uniformAccelerations: List[Series]):
    html = '<h1>Summary</h1>'
    html += '<table><tr><td>Drift #</td><td>Duration</td><td>Significant Wave Height</td></tr>'

    swhSum = 0.0
    durationSum = 0.0

    for index, uniformAcceleration in enumerate(uniformAccelerations):
        elevation = calculateElevationSeries(uniformAcceleration, sampleFreq)
        waveHeights = calculateSortedWaveHeights(elevation)
        duration = uniformAcceleration.duration()
        durationString = formatTimeDelta(duration)

        if len(waveHeights) == 0:
            html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td>No waves detected</td></tr>'
            continue

        swh = significantWaveHeight(waveHeights)
        swhSum += (swh * duration.total_seconds())
        durationSum += duration.total_seconds()

        html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td>{swh:0.2f}</td></tr>'

    if durationSum > 0:
        meanWaveHeight = swhSum / durationSum
        html += f'<tr><td><b>Mean (duration-weighted)</b></td><td></td><td><b>{meanWaveHeight:0.2f}</b></td></tr>'

    html += '</table>'

    return html


def formatTimeDelta(td: timedelta):
    components = []
    seconds = td.seconds
    if seconds >= 60:
        minutes = math.floor(seconds / 60)
        components.append(f'{minutes}m')
        seconds -= (minutes * 60)
    if seconds > 0:
        components.append(f'{seconds}s')

    return ' '.join(components)


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
    seriesSet = SeriesSet.fromH5File(h5File)
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

