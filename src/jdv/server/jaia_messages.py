from dataclasses import dataclass
from dataclasses_json import dataclass_json
from typing import Optional, List
import datetime


@dataclass_json
@dataclass
class Measurement:
    mean_depth: float
    mean_temperature: float
    mean_salinity: float


@dataclass_json
@dataclass
class GeographicCoordinate:
    lon: float
    lat: float


@dataclass_json
@dataclass
class DivePacket:
    depth_achieved: float
    measurement: List[Measurement]
    start_location: GeographicCoordinate

    # fields with default values are optional in the JSON
    duration_to_acquire_gps: Optional[float] = None
    bottom_dive: bool = False
    unpowered_rise_rate: Optional[float] = None
    powered_rise_rate: Optional[float] = None
    bottom_type: Optional[str] = None


@dataclass_json
@dataclass
class EstimatedDrift:
    speed: float
    heading: Optional[float] = None


@dataclass_json
@dataclass
class DriftPacket:
    drift_duration: Optional[float] = None
    estimated_drift: Optional[EstimatedDrift] = None
    start_location: Optional[GeographicCoordinate] = None
    end_location: Optional[GeographicCoordinate] = None
    significant_wave_height: Optional[float] = None
    wave_height: Optional[float] = None
    wave_period: Optional[float] = None


@dataclass_json
@dataclass
class TaskPacket:
    _scheme_: int
    _utime_: int
    bot_id: int
    start_time: int
    end_time: int
    type: str

    dive: Optional[DivePacket] = None
    drift: Optional[DriftPacket] = None

    def date_string(self):
        # _utime_ is in microseconds, but datetime wants seconds
        date = datetime.datetime.fromtimestamp(self._utime_ / 1e6)
        return date.strftime(r'%b %-d, %Y, %I:%M:%S %p')

