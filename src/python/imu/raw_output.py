from dataclasses import dataclass

@dataclass
class RawMagnetometer:
    x: float
    y: float
    z: float
    heading: float

@dataclass
class RawGyroscope:
    x: float
    y: float
    z: float

@dataclass
class RawAccelerometer:
    x: float
    y: float
    z: float
