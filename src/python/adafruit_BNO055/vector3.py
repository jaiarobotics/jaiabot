from dataclasses import dataclass
from math import *


@dataclass
class Vector3:
    x: float
    y: float
    z: float


    def dot(self, other):
        return self.x * other.x + self.y * other.y + self.z * other.z


    def cross(self, other):
        return Vector3(
            self.y * other.z - self.z * other.y,
            -(self.x * other.z - self.z * other.x),
            self.x * other.y - self.y * other.x
        )


    # k * v, scalar pre-multiplication
    def __rmul__(self, other):
        return Vector3(other * self.x, other * self.y, other * self.z)


    # vector addition
    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)


    def magnitude(self):
        return sqrt(self.x * self.x + self.y * self.y + self.z * self.z)


    def to_string(self):
        return f'{self.x},{self.y},{self.z}'

