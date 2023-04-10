from dataclasses import dataclass
from vector3 import Vector3
from orientation import Orientation
from math import *



@dataclass
class Quaternion:
    w: float
    x: float
    y: float
    z: float


    @staticmethod
    def from_tuple(t: tuple):
        if None in t:
            return Quaternion(1, 0, 0, 0)
        return Quaternion(*t)


    # Quaternion * Quaternion (multiplication)
    def __mul__(self, other):
        s1 = self.w
        s2 = other.w
        v1 = Vector3(self.x, self.y, self.z)
        v2 = Vector3(other.x, other.y, other.z)
        v = s1 * v2 + s2 * v1 + v1.cross(v2)

        return Quaternion(
            s1 * s2 - v1.dot(v2),
            v.x, v.y, v.z
        )


    def to_euler_angles(self) -> Orientation:
        DEG = pi / 180

        # roll (x-axis rotation)
        sinr_cosp = 2 * (self.w * self.x + self.y * self.z)
        cosr_cosp = 1 - 2 * (self.x * self.x + self.y * self.y)
        roll = atan2(sinr_cosp, cosr_cosp)

        # pitch (y-axis rotation)
        sinp = sqrt(max(0, (1 + 2 * (self.w * self.y - self.x * self.z))))
        cosp = sqrt(max(0, (1 - 2 * (self.w * self.y - self.x * self.z))))
        pitch = -2 * atan2(sinp, cosp) + pi / 2

        # yaw (z-axis rotation)
        siny_cosp = 2 * (self.w * self.z + self.x * self.y)
        cosy_cosp = 1 - 2 * (self.y * self.y + self.z * self.z)
        yaw = -atan2(siny_cosp, cosy_cosp)

        if yaw < 0:
            yaw += (2 * pi)

        return Orientation(yaw / DEG, pitch / DEG, roll / DEG)


    def unit_inverse(self):
        # Assume unit quaternion!
        return Quaternion(self.w, -self.x, -self.y, -self.z)


    def apply(self, vector: Vector3):
        v_quaternion = Quaternion(0, vector.x, vector.y, vector.z)
        result_quaternion = self.unit_inverse() * v_quaternion * self
        return Vector3(result_quaternion.x, result_quaternion.y, result_quaternion.z)

