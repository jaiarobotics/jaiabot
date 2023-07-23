#!/usr/bin/env python3

from gpsdclient import GPSDClient
from gpsdsimulator import GPSDSimulator, WaveComponent
from analyzer import Analyzer, GPSSample
from time import sleep


analyzer = Analyzer()
gpsdClient = GPSDSimulator(wave_components=[WaveComponent(frequency=1.3, amplitude=7)])


for result in gpsdClient.dict_stream(convert_datetime=True, filter=["TPV"]):
    sample = GPSSample.fromTPVDict(result)
    analyzer.addSample(sample)
    print(analyzer.significantWaveHeight())
    sleep(1)

    