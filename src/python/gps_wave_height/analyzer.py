from dataclasses import dataclass
from datetime import datetime
from statistics import stdev

@dataclass
class GPSSample:
    time: datetime
    lat: float
    lon: float
    alt: float

    @staticmethod
    def fromTPVDict(tpvDict: dict):
        try:
            time = tpvDict['time']
            lat = tpvDict['lat']
            lon = tpvDict['lon']
            alt = tpvDict['altHAE']
        except KeyError:
            return None

        return GPSSample(time, lat, lon, alt)
    

MAX_SAMPLES = 1000

class Analyzer:
    samples: list[GPSSample] = []

    def addSample(self, sample: GPSSample):
        if sample is None:
            return

        self.samples.append(sample)

        if len(self.samples) > MAX_SAMPLES:
            self.samples.pop(0)

    def clearSamples(self):
        self.samples = []

    def significantWaveHeight(self):
        if len(self.samples) < 2:
            return None

        alts = [sample.alt for sample in self.samples]
        print(alts)
        return 4 * stdev([sample.alt for sample in self.samples])
    