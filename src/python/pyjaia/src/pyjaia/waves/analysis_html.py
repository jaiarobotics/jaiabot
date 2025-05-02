from datetime import timedelta
import statistics
from typing import *
from math import *
import numpy
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from dataclasses import asdict
from pprint import pformat

from .types import Drift
from .processing import *
from . import spectrogram
from pyjaia.series import Series
from .series_set import SeriesSet
from .moskowitz import *

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


def htmlForWaves(sortedWaves: List[Wave]):
    html = ''
    html += '<table><tr><td>Wave Heights:</td>'
    minIndexToUse = floor(len(sortedWaves) * 2 / 3)
    for index, wave in enumerate(sortedWaves):
        if index >= minIndexToUse:
            html += f'<td class="used">{wave.height:0.3f}</td>'
        else:
            html += f'<td>{wave.height:0.3f}</td>'
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

    htmlString = '<h1>Band pass filter</h1>'
    htmlString += fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='50%', default_height='50%')

    return htmlString


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


def htmlForSummaryTable(drifts: List[Drift], config: DriftAnalysisConfig):
    html = '<h1>Summary</h1>'
    html += '<table><tr><td>Drift #</td><td>Duration</td><td>Significant Wave Height (m)</td><td>Maximum Wave Height (m)</td><td>Peak Period (s)</td></tr>'

    swhSum = 0.0
    durationSum = 0.0

    for index, drift in enumerate(drifts):
        duration = drift.rawVerticalAcceleration.duration()
        durationString = formatTimeDelta(duration)

        if drift.waves is not None and len(drift.waves) == 0:
            html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td colspan="3">No waves detected</td></tr>'
            continue

        swh = drift.significantWaveHeight
        swhSum += (swh * duration.total_seconds())
        durationSum += duration.total_seconds()

        if drift.maxWaveHeight is not None:
            maxWaveHeight = f"{drift.maxWaveHeight:0.2f}"
        else:
            maxWaveHeight = "N/A"

        peakPeriod = drift.peakWavePeriod

        html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td>{swh:0.2f}</td><td>{maxWaveHeight}</td><td>{peakPeriod:0.2f}</td></tr>'

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

    if drift.waves is not None and len(drift.waves) > 0:
        waveHeights = [wave.height for wave in drift.waves]
        swh = statistics.mean(waveHeights[floor(len(waveHeights)*2/3):])
        htmlString += f'<h3>Significant Wave Height via wave counting: {swh:0.2f}<h3>'

        # The wave heights
        htmlString += htmlForWaves(drift.waves)

    htmlString += htmlForChart([drift.rawVerticalAcceleration, drift.filteredVerticalAcceleration, drift.elevation])
    htmlString += htmlForPowerDensitySpectrum(drift.powerDensitySpectrum, drift.filteredVerticalAcceleration.averageSampleFrequency())

    return htmlString
    

def htmlForPowerDensitySpectrum(spectrum: List[float], sampleFrequency: float) -> str:
    htmlString = ''
    if spectrum is None:
        return htmlString

    fig = go.Figure()
    
    x: List[float] = []
    N = len(spectrum)
    for i in range(0, N):
        f = i * sampleFrequency / 2 / N
        x.append(f)

    fig.add_trace(go.Scatter(x=x, y=spectrum, name="Power Density Spectrum"))

    # Show Moskowitz model power density spectrum
    moskowitzModelY = [0.0] + [moscowitzS(x[i], 6.0) for i in range(1, len(x))]
    fig.add_trace(go.Scatter(x=x, y=moskowitzModelY, name="Moskowitz Model"))

    fig.update_layout(
        xaxis_title="Frequency (Hz)",
        yaxis_title="Power Density (m^2/Hz)",
        legend_title="Legend"
    )

    htmlString += fig.to_html(full_html=False, include_plotlyjs='cdn', default_width='80%', default_height='60%')

    return htmlString


def htmlForDriftAnalysisConfig(config: DriftAnalysisConfig):
    htmlString = '<h2>Configuration</h2>'
    htmlString += f'<pre>{pformat(asdict(config))}</pre>'
    return htmlString

