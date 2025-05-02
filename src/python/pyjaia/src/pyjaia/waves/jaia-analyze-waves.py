#!/usr/bin/env python3

import h5py
from pyjaia.series import *
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
from datetime import datetime
from typing import *
from math import *
from pyjaia.waves.processing import *
from pyjaia.waves.filters import *
from pathlib import *
from statistics import *
from pyjaia.waves.series_set import *
from pyjaia.waves.types import *
from pyjaia.waves.analysis_html import *
from pyjaia.waves.analysis import *
from dataclasses import *


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


def doPlots(h5FilePath: Path, config: DriftAnalysisConfig, drifts: List[Drift]):
    description = h5FilePath.stem
    method = config.analysis.type
    htmlFilePath = h5FilePath.parent.joinpath(f'waveAnalysis-{description}-{method}.html')
    htmlFilename = str(htmlFilePath)

    bandPassFilter = getBandPassFilterFunc(config.bandPassFilter)

    with open(htmlFilename, 'w') as f:
        f.write('<html><meta charset="utf-8">\n')

        f.write(cssTag)
        f.write(f'<h1>File: {h5FilePath.name}</h1>')
        f.write(f'<h2>Analysis methodology: {asdict(config.analysis)}</h2>')
        f.write(htmlForSummaryTable(drifts, config))

        f.write(htmlForFilterGraph(bandPassFilter))

        # Drift altitude and filtered altitude series
        for driftIndex, drift in enumerate(drifts):
            f.write(htmlForDriftObject(drift, driftIndex + 1))

        f.write(htmlForDriftAnalysisConfig(config))

        f.write('</html>\n')

    os.system(f'xdg-open {htmlFilename}')


def analyzeFile(h5File: h5py.File, config: DriftAnalysisConfig):
    seriesSet = SeriesSet.loadFromH5File(h5File)

    if config.glitchy:
        seriesSet.filterGlitches()

    driftSeriesSets = seriesSet.split(isInDriftState)

    drifts: List[Drift] = []

    for driftSeriesSet in driftSeriesSets:
        drift = doDriftAnalysis(driftSeriesSet.accelerationVertical, config)
        drifts.append(drift)

    doPlots(Path(h5File.filename), config, drifts)


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('config_file')
    parser.add_argument('h5_files', nargs='+')
    args = parser.parse_args()

    config = DriftAnalysisConfig.load(args.config_file)
    print(config)

    for h5Path in args.h5_files:
        h5File = h5py.File(h5Path)
        analyzeFile(h5File, config)


if __name__ == '__main__':
    main()
