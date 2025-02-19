#!/usr/bin/env python3

import h5py
from pyjaia.series import *
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
from datetime import datetime
import pytz
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

    return htmlFilename


def getDrifts(h5File: h5py.File, config: DriftAnalysisConfig):
    seriesSet = SeriesSet.loadFromH5File(h5File)

    if config.glitchy:
        seriesSet.filterGlitches()

    driftSeriesSets = seriesSet.split(isInDriftState)

    drifts: List[Drift] = []

    for driftSeriesSet in driftSeriesSets:
        drift = doDriftAnalysis(driftSeriesSet.accelerationVertical, config)
        drifts.append(drift)

    return drifts


def writeCSVs(h5_filename: str, config: AnalysisConfig, drifts: List[Drift]):
    import csv
    print('Writing CSV files')

    for drift_index, drift in enumerate(drifts):
        assert(len(drift.filteredVerticalAcceleration.utime) == len(drift.elevation.utime))

        csv_filename = f'{h5_filename}-drift-{drift_index + 1}.csv'

        with open(csv_filename, 'w') as fp:
            columns = {
                'timestamp (micros)': drift.rawVerticalAcceleration.utime,
                'time (UTC)': [datetime.fromtimestamp(timestamp / 1e6, tz=pytz.utc) for timestamp in drift.rawVerticalAcceleration.utime],
                'filtered acceleration (m/s^2)': drift.filteredVerticalAcceleration.y_values,
                'elevation (m)': drift.elevation.y_values
            }

            writer = csv.DictWriter(fp, columns.keys())
            writer.writeheader()

            for time_index in range(len(drift.filteredVerticalAcceleration.utime)):
                writer.writerow({ column_name: column_list[time_index] for column_name, column_list in columns.items()})


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('config_file')
    parser.add_argument('h5_files', nargs='+')
    parser.add_argument('-c', '--csv', action='store_true', help='Write CSV files for data series.')
    parser.add_argument('-o', '--open', action='store_true', help='Open html files after generating them.')

    @dataclass
    class Args:
        config_file: str
        h5_files: List[str]
        csv: bool
        open: bool

    args: Args = parser.parse_args()

    config = DriftAnalysisConfig.load(args.config_file)

    for h5Path in args.h5_files:
        h5File = h5py.File(h5Path)
        drifts = getDrifts(h5File, config)

        htmlFilename = doPlots(Path(h5File.filename), config, drifts)

        if args.open:
            os.system(f'xdg-open {htmlFilename}')

        if args.csv:
            writeCSVs(h5File.filename, config, drifts)



if __name__ == '__main__':
    main()
