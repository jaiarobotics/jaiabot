from dataclasses import dataclass



@dataclass
class Orientation:
    heading: float | None
    pitch: float
    roll: float


    def to_string(self):
        return f'{self.heading},{self.pitch},{self.roll}'
