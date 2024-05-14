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
from pyjaia.waves.processing import *
from pyjaia.waves.filters import *
from pathlib import *
from statistics import *
from pyjaia.waves.series_set import *
from pyjaia.waves.drift import Drift
from pyjaia.waves import doAnalysis
from pyjaia.waves.analysis_html import *


def htmlForSummaryTable(drifts: List[Drift]):
    html = '<h1>Summary</h1>'
    html += '<table><tr><td>Drift #</td><td>Duration</td><td>Significant Wave Height</td></tr>'

    swhSum = 0.0
    durationSum = 0.0

    for index, drift in enumerate(drifts):
        duration = drift.rawVerticalAcceleration.duration()
        durationString = formatTimeDelta(duration)

        if len(drift.waveHeights) == 0:
            html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td>No waves detected</td></tr>'
            continue

        swh = drift.significantWaveHeight
        swhSum += (swh * duration.total_seconds())
        durationSum += duration.total_seconds()

        html += f'<tr><td><a href="#{index + 1}">{index + 1}</a></td><td>{durationString}</td><td>{swh:0.2f}</td></tr>'

    if durationSum > 0:
        meanWaveHeight = swhSum / durationSum
        html += f'<tr><td><b>Mean (duration-weighted)</b></td><td></td><td><b>{meanWaveHeight:0.2f}</b></td></tr>'

    html += '</table>'

    return html


cssTag = '''<style>
    td { 
        padding: 15pt;
        border: 1pt solid lightblue
    }

    td.used {
        font-weight: bold;
        background-color: lightcyan;
    }
</style>'''


def doPlots(h5FilePath: Path, drifts: List[Drift]):
    description = h5FilePath.stem
    htmlFilePath = h5FilePath.parent.joinpath(f'waveAnalysis-{description}-{datetime.now().strftime("%Y%m%dT%H%M%S")}.html')
    htmlFilename = str(htmlFilePath)

    with open(htmlFilename, 'w') as f:
        f.write('<html><meta charset="utf-8">\n')

        f.write(cssTag)
        f.write(f'<h1>{description}</h1>')
        f.write(htmlForSummaryTable(drifts))

        f.write(htmlForFilterGraph(bandPassFilter))

        # Drift altitude and filtered altitude series
        for driftIndex, drift in enumerate(drifts):
            f.write(htmlForDriftObject(drift, driftIndex + 1))

        f.write('</html>\n')

    os.system(f'xdg-open {htmlFilename}')


def analyzeFile(h5File: h5py.File, sampleFreq: float, glitchy: bool):
    seriesSet = SeriesSet.loadFromH5File(h5File)

    if glitchy:
        seriesSet.filterGlitches()

    driftSeriesSets = seriesSet.split(isInDriftState)

    drifts: List[Drift] = []

    for driftSeriesSet in driftSeriesSets:
        drift = doAnalysis(driftSeriesSet.accelerationVertical, sampleFreq)
        drifts.append(drift)

    doPlots(Path(h5File.filename), drifts)


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--glitchy', action='store_true')
    parser.add_argument('filenames', nargs='+')
    args = parser.parse_args()

    for h5Path in args.filenames:
        h5File = h5py.File(h5Path)
        analyzeFile(h5File, sampleFreq=4, glitchy=args.glitchy)


if __name__ == '__main__':
    main()
