from dataclasses import dataclass

@dataclass
class RawMagnetometer:
    x: float
    y: float
    z: float
    heading: float
