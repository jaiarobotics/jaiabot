from datetime import timedelta
import statistics
from typing import *
from math import *
import numpy
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from .drift import Drift
from .processing import *
from . import spectrogram
from pyjaia.series import Series
from .series_set import SeriesSet

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


def htmlForDriftObject(drift: Drift, driftIndex: int=None) -> str:
    # Header
    htmlString: str = ''

    if driftIndex is not None:
        htmlString += f'<h1><a id="{driftIndex}">Drift {driftIndex}</a></h1>'
    else:
        htmlString += f'<h1>Drift</h1>'

    durationString = formatTimeDelta(drift.rawVerticalAcceleration.duration())
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
    

