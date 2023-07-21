from typing import Iterable, Dict, Any
import json
import datetime
from math import cos, pi
from dataclasses import dataclass


@dataclass
class WaveComponent:
    frequency: float = 0.0
    amplitude: float = 0.0


class GPSDSimulator:
    wave_components: Iterable[WaveComponent]

    def __init__(self, wave_components: Iterable[WaveComponent]):
        self.wave_components = wave_components

    def json_stream(self, filter: any) -> Iterable[str]:
        yield json.dumps(self.dict_stream(filter=filter))

    def dict_stream(self, *, convert_datetime: bool = True, filter: any) -> Iterable[Dict[str, Any]]:
        while True:
            t = datetime.datetime.now().timestamp()

            altitude = sum([component.amplitude * cos(t * 2 * pi / component.frequency) for component in self.wave_components])

            yield {
                'lat': 43.0,
                'lon': -72.0,
                'altHAE': altitude
            }

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.close()

    def __del__(self):
        self.close()
