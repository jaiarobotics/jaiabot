from dataclasses import dataclass
from vector3 import Vector3
from orientation import Orientation
from math import *


DEG = pi / 180


@dataclass
class Quaternion:
    w: float
    x: float
    y: float
    z: float


    @staticmethod
    def from_wxyz(w: float, x: float, y: float, z: float):
        return Quaternion(w, x, y, z)


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
    

    def to_euler_angles_alt(q) -> Orientation:
        roll = atan2(2*(q.w*q.x + q.y*q.z), 1 - 2*(q.x*q.x + q.y*q.y))
        pitch = -pi/2 + 2 * atan2(sqrt(1 + 2*(q.w*q.y - q.x*q.z)), sqrt(1 - 2 * (q.w*q.y - q.x*q.z)))
        yaw = atan2(2 * (q.w*q.z + q.x*q.y), 1 - 2 * (q.y*q.y + q.z*q.z))
        return Orientation(heading=-yaw / DEG, pitch=-pitch / DEG, roll=roll / DEG)


    def unit_inverse(self):
        # Assume unit quaternion!
        return Quaternion(self.w, -self.x, -self.y, -self.z)
    

    def magnitude(self) -> float:
        return sqrt(self.w*self.w + self.x*self.x + self.y*self.y + self.z*self.z)


    def apply(self, vector: Vector3):
        v_quaternion = Quaternion(0, vector.x, vector.y, vector.z)
        result_quaternion = self.unit_inverse() * v_quaternion * self
        return Vector3(result_quaternion.x, result_quaternion.y, result_quaternion.z)


if __name__ == '__main__':
    print(Quaternion(0.55, 0.01, -0.01, -0.8).to_euler_angles())
    print(Quaternion(0.55, 0.01, -0.01, -0.8).to_euler_angles_alt())

    print(Quaternion(0.53, -0.17, -0.19, -0.8).to_euler_angles())
    print(Quaternion(0.53, -0.17, -0.19, -0.8).to_euler_angles_alt())

    print(Quaternion(0.39, 0.45, -0.52, -0.58).to_euler_angles())
    print(Quaternion(0.39, 0.45, -0.52, -0.58).to_euler_angles_alt())

