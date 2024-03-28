#!/usr/bin/env python3

import h5py
from series import *
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
from copy import deepcopy
from processing import *
from filters import *
from pprint import pprint
from pathlib import *
from statistics import *



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
    periods = numpy.arange(0.1, 25.0, 0.1)
    y = [filterFunc(1/period) for period in periods]

    fig.add_trace(go.Scatter(x=periods, y=y, name=f'Filter Coefficient'))
    fig.update_layout(
        title=f"Band pass filter",
        xaxis_title="Wave Period (s)",
        yaxis_title="Coefficient",
        legend_title="Legend"
    )

    return '<h1>Band pass filter</h1>' + fig.to_html(full_html=False, include_plotlyjs='cdn')


def processSeries(series: Series, steps: List[ProcessingStep]):
    for step in steps:
        series = step(series)
    return series


def htmlForCharts(charts: List[List[Series]], waveHeights: List[float], index: int):
    # Header
    htmlString = ''

    htmlString += f'<h1><a id="{index + 1}">Drift #{index + 1}</a></h1>'
    durationString = formatTimeDelta(charts[0][0].duration())
    htmlString += f'<h3>Drift duration: {durationString}<h3>'

    if len(waveHeights) > 0:
        swh = statistics.mean(waveHeights[floor(len(waveHeights)*2/3):])
        htmlString += f'<h3>Significant Wave Height: {swh:0.2f}<h3>'

    # The wave heights
    htmlString += htmlForWaves(waveHeights)

    figures: List[go.Figure] = []

    for chart in charts:
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        yaxis_titles = []
        for series in chart:
            fig.add_trace(go.Scatter(x=series.datetimes(), y=series.y_values, name=series.name))
            yaxis_titles.append(series.name)

        fig.update_layout(
            xaxis_title="Time",
            yaxis_title=','.join(yaxis_titles),
            legend_title="Legend"
        )
        figures.append(fig)    

    for fig in figures:
        htmlString += fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='80%', default_height='60%')

    return htmlString


def htmlForFFTGraph(series: Series, sampleFreq: float, bandPassFilter: Callable[[float], float]):
    # The FFT
    fft = getFFT(series, sampleFreq)

    fig = make_subplots()
    fig.add_trace(go.Scatter(x=fft.frequencies, y=[a.real for a in fft.amplitudes], name=f'Real FFT', mode='markers'))
    fig.add_trace(go.Scatter(x=fft.frequencies, y=[a.imag for a in fft.amplitudes], name=f'Imag FFT', mode='markers'))
    fig.add_trace(go.Scatter(x=fft.frequencies, y=[bandPassFilter(f) for f in fft.frequencies], name='Filter'))
    fig.update_layout(
        title=f"Real FFT",
        xaxis_title="Frequency (Hz)",
        yaxis_title="Amplitude (m) or Filter Coefficient",
        legend_title="Legend"
    )
    fig.update_yaxes(type='log', range=[-3, 1])

    return fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='35%', default_height='40%')


def htmlForSummaryTable(seriesList: List[Series], processingSteps: List[ProcessingStep]):
    html = '<h1>Summary</h1>'
    html += '<table><tr><td>Drift #</td><td>Duration</td><td>Significant Wave Height</td></tr>'

    swhSum = 0.0
    durationSum = 0.0

    for index, series in enumerate(seriesList):
        filteredSeries = processSeries(series, processingSteps)
        waveHeights = calculateSortedWaveHeights(filteredSeries)
        duration = seriesList[index].duration()
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


def filterAndPlot(h5FilePath: Path, 
                  accelerationSeries: Series, 
                  otherSeriesList: List[Series], 
                  sampleFreq: float, 
                  splitFunc: Callable[[Series, int], bool], 
                  bandPassFilter: Callable[[float], float]):
    
    driftAccelerationSeries = getSubSeriesList(accelerationSeries, splitFunc)

    print([series.count() for series in driftAccelerationSeries])

    otherSeriesList = [getSubSeriesList(series, splitFunc) for series in otherSeriesList]

    description = h5FilePath.stem
    htmlFilePath = h5FilePath.parent.joinpath(f'waveAnalysis-{description}-{datetime.now().strftime("%Y%m%dT%H%M%S")}.html')
    htmlFilename = str(htmlFilePath)
    SWHs = []

    # PROCESSING STEPS
    processToElevationSteps = [
        deMean,
        (lambda series: fadeSeries(series, 10e6, 5e6, 5e6)),
        (lambda series: accelerationToElevation(series, sampleFreq=sampleFreq, filterFunc=bandPassFilter)),
    ]

    filterAccelerationSteps = [
        deMean,
        (lambda series: fadeSeries(series, 10e6, 5e6, 5e6)),
        (lambda series: filterFrequencies(series, sampleFreq=sampleFreq, filterFunc=bandPassFilter)),
    ]
    ###################

    with open(htmlFilename, 'w') as f:
        f.write('<html><meta charset="utf-8">\n')

        f.write(cssTag)
        f.write(f'<h1>{description}</h1>')
        f.write(htmlForSummaryTable(driftAccelerationSeries, processToElevationSteps))

        f.write(htmlForFilterGraph(bandPassFilter))

        # Drift altitude and filtered altitude series
        for driftIndex, rawAccelerationSeries in enumerate(driftAccelerationSeries):
            filteredAccelerationSeries = processSeries(rawAccelerationSeries, filterAccelerationSteps)
            filteredAccelerationSeries.name = 'Filtered acceleration'

            elevationSeries = processSeries(rawAccelerationSeries, processToElevationSteps)
            elevationSeries.name = 'Calculated Elevation'

            charts = [[rawAccelerationSeries, filteredAccelerationSeries, elevationSeries]]

            if len(otherSeriesList) > 0:
                charts.append([series[driftIndex] for series in otherSeriesList])

            waves = calculateSortedWaveHeights(elevationSeries)

            f.write(htmlForCharts(charts, waves, index=driftIndex))

        f.write('</html>\n')

    os.system(f'xdg-open {htmlFilename}')

    print('Significant Wave Heights')
    for i in range(0, len(SWHs)):
        print(f'Drift {i}: {SWHs[i]:0.2f} m')


def plotSWHVersusWindowDuration(accelerations: List[Series], sampleFreq: float, bandPassFilter: Callable[[float], float]):
    # Try different time windows
    def xrange(start, end, delta):
        val = start

        while val < end:
            yield val
            val += delta

    fig = make_subplots()

    for acceleration in accelerations:
        duration = acceleration.duration().total_seconds()

        windowDurations = list(xrange(10, duration - 15, 5))
        swhs: List[float] = []

        for windowDuration in windowDurations:
            processToElevationSteps = [
                fadeSeries(10e6, (duration - windowDuration - 10) * 1e6, 2e6),
                getUniformSeries(freq=sampleFreq),
                accelerationToElevation(sampleFreq=sampleFreq, filterFunc=bandPassFilter),
            ]

            elevation = processSeries(acceleration, processToElevationSteps)
            waves = elevation.sortedWaveHeights()
            swh = significantWaveHeight(waves)

            swhs.append(swh)

        fig.add_trace(go.Scatter(x=windowDurations, y=swhs, name=f'SWH', mode='lines+markers'))

    fig.update_layout(
        title=f"SWH vs Window Duration",
        xaxis_title="Window Duration (seconds)",
        yaxis_title="SWH (meters)",
        legend_title="Legend"
    )

    fig.show()



def filterIMUData(ax: Series, ay: Series, az: Series, gx: Series, gy: Series, gz: Series):
    rax = ax.cleared()
    ray = ay.cleared()
    raz = az.cleared()

    rgx = gx.cleared()
    rgy = gy.cleared()
    rgz = gz.cleared()

    for i in range(len(ax.y_values)):
        g = [gx.y_values[i], gy.y_values[i], gz.y_values[i]]
        a = [ax.y_values[i], ay.y_values[i], az.y_values[i]]

        g_mag_squared = g[0] * g[0] + \
                        g[1] * g[1] + \
                        g[2] * g[2] 
        
        if g_mag_squared < (8 * 8) or g_mag_squared > (50 * 50):
            continue

        a_mag_squared = a[0] * a[0] + \
                       a[1] * a[1] + \
                       a[2] * a[2]

        if a_mag_squared == 0 or a_mag_squared > (50 * 50):
            continue

        if abs(g[0]) < 0.02 or abs(g[1]) < 0.02 or abs(g[2]) < 0.02: # Sometimes the gravity components glitch out to 0.01 for no reason
            continue

        rax.appendPair(ax.get(i))
        ray.appendPair(ay.get(i))
        raz.appendPair(az.get(i))

        rgx.appendPair(gx.get(i))
        rgy.appendPair(gy.get(i))
        rgz.appendPair(gz.get(i))

    return rax, ray, raz, rgx, rgy, rgz


def doAnalysis(h5File: h5py.File):
    missionStateSeries = readSeriesFromHDF5File(h5File, 'jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/mission_state')
    altitudeSeries = readSeriesFromHDF5File(h5File, 'goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/altitude', invalid_values=[None])
    
    raw_acc_x = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/x', invalid_values=[None], name='acc.x')
    raw_acc_y = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/y', invalid_values=[None], name='acc.y')
    raw_acc_z = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z', invalid_values=[None], name='acc.z')

    raw_grav_x = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/x', invalid_values=[None], name='grav.x')
    raw_grav_y = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/y', invalid_values=[None], name='grav.y')
    raw_grav_z = readSeriesFromHDF5File(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/gravity/z', invalid_values=[None], name='grav.z')

    acc_x, acc_y, acc_z, grav_x, grav_y, grav_z = filterIMUData(raw_acc_x, raw_acc_y, raw_acc_z, raw_grav_x, raw_grav_y, raw_grav_z)

    acc_x = filterAcc(acc_x)
    acc_y = filterAcc(acc_y)
    acc_z = filterAcc(acc_z)

    grav_x = filterAcc(grav_x)
    grav_y = filterAcc(grav_y)
    grav_z = filterAcc(grav_z)

    accelerationSeries = Series()
    accelerationSeries.name = 'acceleration'
    accelerationSeries.utime = acc_x.utime
    for i in range(len(acc_x.utime)):
        accelerationSeries.y_values.append((acc_x.y_values[i] * grav_x.y_values[i] + 
                                            acc_y.y_values[i] * grav_y.y_values[i] + 
                                            acc_z.y_values[i] * grav_z.y_values[i]) / 9.8)
        
    otherSeriesList = [
        raw_acc_x, acc_x,
        raw_acc_y, acc_y,
        raw_acc_z, acc_z,
        raw_grav_x, grav_x,
        raw_grav_y, grav_y,
        raw_grav_z, grav_z,
        # Series(h5File, 'goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity/mode', invalid_values=[None])
        # Series(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/euler_angles/pitch', invalid_values=[None])
        # accelerationMagnitudeSeries,
        # Series(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/x', invalid_values=[None]),
        # Series(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/y', invalid_values=[None]),
        # Series(h5File, '/jaiabot::imu/jaiabot.protobuf.IMUData/linear_acceleration/z', invalid_values=[None]),
    ]

    # Here we list time ranges that we know we don't want to use (motorized setup wasn't running, etc)
    blacklistedTimeRanges = [
        {
            'min': datetime.fromisoformat('2023-08-09T14:03:54').timestamp() * 1e6, 
            'max': datetime.fromisoformat('2023-08-09T14:05:42').timestamp() * 1e6
        }
    ]

    def splitFunc(series: Series, index: int):
        '''Returns True if this point is part of a valid drift'''
        utime = series.utime[index]

        # False if we're not in a DRIFT
        if missionStateSeries.getValueAtTime(utime) != 121:
            return False
        
        # False if within a blacklisted time range
        for r in blacklistedTimeRanges:
            if utime > r['min'] and utime < r['max']:
                return False

        return True

    sampleFreq = 4
    uniformAccelerationSeries = getUniformSeries(freq=sampleFreq)(accelerationSeries)
    bandPassFilter = gaussianFilter(0.1, 2.0, k=1000)
    bandPassFilter = cos2Filter(1/15, 2.0, 0.01)
    filterAndPlot(Path(h5File.filename), uniformAccelerationSeries, otherSeriesList=otherSeriesList, sampleFreq=sampleFreq, splitFunc=splitFunc, bandPassFilter=bandPassFilter)


if __name__ == '__main__':
    for h5Path in sys.argv[1:]:
        h5File = h5py.File(h5Path)
        doAnalysis(h5File)

