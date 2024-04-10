from datetime import timedelta
import statistics
from typing import *
from math import *
import numpy
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from waves.drift import Drift
import spectrogram
from pyjaia.series import Series
from waves import *


def formatTimeDelta(td: timedelta):
    components = []
    seconds = td.seconds
    if seconds >= 60:
        minutes = floor(seconds / 60)
        components.append(f'{minutes}m')
        seconds -= (minutes * 60)
    if seconds > 0:
        components.append(f'{seconds}s')

    return ' '.join(components)


def htmlForWaves(sortedWaveHeights: List[float]):
    html = ''
    html += '<table><tr><td>Wave Heights:</td>'
    minIndexToUse = floor(len(sortedWaveHeights) * 2 / 3)
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


def htmlForChart(charts: List[Series]) -> str:
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
    sampleFreq = drift.accelerationVertical.averageSampleFrequency()
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
        sampleFreq = uniformAcceleration.averageSampleFrequency()
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
        minutes = floor(seconds / 60)
        components.append(f'{minutes}m')
        seconds -= (minutes * 60)
    if seconds > 0:
        components.append(f'{seconds}s')

    return ' '.join(components)


def htmlForDriftObject(drift: Drift) -> str:
    # Header
    htmlString: str = ''

    htmlString += f'<h1>Drift Analysis</h1>'
    durationString = formatTimeDelta(drift.elevation.duration())
    htmlString += f'<h3>Drift duration: {durationString}<h3>'

    if len(drift.waveHeights) > 0:
        swh = statistics.mean(drift.waveHeights[floor(len(drift.waveHeights)*2/3):])
        htmlString += f'<h3>Significant Wave Height: {swh:0.2f}<h3>'

    # The wave heights
    htmlString += htmlForWaves(drift.waveHeights)

    htmlString += htmlForChart([drift.rawVerticalAcceleration, drift.filteredVerticalAcceleration, drift.elevation])
    htmlString += spectrogram.htmlForSpectrogram(drift.rawVerticalAcceleration, fftWindowSeconds=80)
    htmlString += spectrogram.htmlForSpectrogram(drift.filteredVerticalAcceleration, fftWindowSeconds=80)

    return htmlString
    

