from dataclasses import dataclass
from dataclasses_json import dataclass_json
from typing import Optional, List, Union
import datetime


@dataclass_json
@dataclass
class Measurement:
    mean_depth: Optional[float] = None
    mean_temperature: Optional[float] = None
    mean_salinity:Optional[float] = None


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
    bot_id: int
    start_time: int
    end_time: int
    type: str

    dive: Optional[DivePacket] = None
    drift: Optional[DriftPacket] = None

    _scheme_: Optional[int] = 1
    _utime_: Optional[int] = 0


def micros_to_string(micros: Union[float, str], format_string=r'%b %-d, %Y, %I:%M:%S %p'):
    return datetime.datetime.fromtimestamp(float(micros) / 1e6).strftime(format_string)
