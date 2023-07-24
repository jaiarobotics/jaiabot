from dataclasses import dataclass
from datetime import datetime
from statistics import stdev
from typing import List
from gpsdclient import GPSDClient
from gpsdsimulator import GPSDSimulator
from threading import Thread, Lock
from time import sleep



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
    samples: List[GPSSample] = []
    client: GPSDClient
    sampleFrequency: float

    _thread: Thread
    _lock: Lock
    _sampling = False

    def __init__(self, client: GPSDClient, sampleFrequency: float = 2.5) -> None:
        self.client = client
        self.sampleFrequency = sampleFrequency
        self._lock = Lock()

    def start(self):
        with self._lock:
            if self._sampling:
                return

            self.samples = []
            self._sampling = True
            self._thread = Thread(target=lambda: self.loop(), daemon=True)
            self._thread.start()

    def stop(self):
        with self._lock:
            self._sampling = False
            self.samples = []

    def loop(self):
        for result in self.client.dict_stream(filter=['TPV']):
            sample = GPSSample.fromTPVDict(result)
            self.addSample(sample)
            sleep(1 / self.sampleFrequency)

            with self._lock:
                if not self._sampling:
                    break

    def addSample(self, sample: GPSSample):
        if sample is None:
            return

        with self._lock:
            self.samples.append(sample)

            if len(self.samples) > MAX_SAMPLES:
                self.samples.pop(0)

    def clearSamples(self):
        with self._lock:
            self.samples = []

    def significantWaveHeight(self):
        with self._lock:
            if len(self.samples) < 2:
                return 0.0

            alts = [sample.alt for sample in self.samples]
            return 4 * stdev(alts)
    