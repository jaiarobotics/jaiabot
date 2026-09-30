"""Madgwick orientation filter, accelerometer + gyroscope only (S. Madgwick, "An efficient orientation filter
for inertial and inertial/magnetic sensor arrays", 2010).

Pitch and roll are referenced to gravity; yaw is not referenced to anything (it drifts from where it started),
so callers that need a heading must supply it separately.

The output quaternion uses the same convention as the BNO085 rotation vector consumed by
../adafruit/imu_bno085.py: Hamilton (w, x, y, z), rotating body-frame vectors (+x forward, +y port,
+z up) into an East-North-Up world frame.
"""
from math import sqrt

HALF_SQRT2 = sqrt(0.5)


class Madgwick:
    def __init__(self, beta: float = 0.1):
        self.beta = beta
        # Internal state: rotation from body frame to North-West-Up (Madgwick's native earth frame)
        self.q0, self.q1, self.q2, self.q3 = 1.0, 0.0, 0.0, 0.0

    def initialize(self, accel):
        """Set pitch and roll directly from a single accelerometer sample, instead of waiting for the filter to
        converge. Yaw is set so that body +x points along world north."""
        up = _normalized(accel)
        if up is None:
            return
        # Body +x projected onto the horizontal plane
        north = _normalized(_sub((1.0, 0.0, 0.0), _scale(up, up[0])))
        if north is None:  # body +x points straight up or down
            north = _normalized(_sub((0.0, 1.0, 0.0), _scale(up, up[1])))
        west = _cross(up, north)

        # Rows of the body -> North-West-Up rotation matrix are the world axes expressed in the body frame
        self.q0, self.q1, self.q2, self.q3 = _matrix_to_quaternion((north, west, up))

    def update(self, gyro, accel, dt: float):
        """Advance the filter by dt seconds.

        gyro: (x, y, z) angular rate in rad/s
        accel: (x, y, z) specific force, any units (normalized internally)
        """
        gx, gy, gz = gyro
        ax, ay, az = accel
        q0, q1, q2, q3 = self.q0, self.q1, self.q2, self.q3

        # Rate of change of quaternion from gyroscope
        qDot1 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz)
        qDot2 = 0.5 * (q0 * gx + q2 * gz - q3 * gy)
        qDot3 = 0.5 * (q0 * gy - q1 * gz + q3 * gx)
        qDot4 = 0.5 * (q0 * gz + q1 * gy - q2 * gx)

        # Gradient descent correction toward the measured gravity direction
        a_norm = sqrt(ax * ax + ay * ay + az * az)
        if a_norm > 0.0:
            ax, ay, az = ax / a_norm, ay / a_norm, az / a_norm

            _2q0, _2q1, _2q2, _2q3 = 2 * q0, 2 * q1, 2 * q2, 2 * q3
            _4q0, _4q1, _4q2 = 4 * q0, 4 * q1, 4 * q2
            _8q1, _8q2 = 8 * q1, 8 * q2
            q0q0, q1q1, q2q2, q3q3 = q0 * q0, q1 * q1, q2 * q2, q3 * q3

            s0 = _4q0 * q2q2 + _2q2 * ax + _4q0 * q1q1 - _2q1 * ay
            s1 = _4q1 * q3q3 - _2q3 * ax + 4 * q0q0 * q1 - _2q0 * ay - _4q1 + _8q1 * q1q1 + _8q1 * q2q2 + _4q1 * az
            s2 = 4 * q0q0 * q2 + _2q0 * ax + _4q2 * q3q3 - _2q3 * ay - _4q2 + _8q2 * q1q1 + _8q2 * q2q2 + _4q2 * az
            s3 = 4 * q1q1 * q3 - _2q1 * ax + 4 * q2q2 * q3 - _2q2 * ay

            s_norm = sqrt(s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3)
            if s_norm > 0.0:
                qDot1 -= self.beta * s0 / s_norm
                qDot2 -= self.beta * s1 / s_norm
                qDot3 -= self.beta * s2 / s_norm
                qDot4 -= self.beta * s3 / s_norm

        q0 += qDot1 * dt
        q1 += qDot2 * dt
        q2 += qDot3 * dt
        q3 += qDot4 * dt
        q_norm = sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3)
        self.q0, self.q1, self.q2, self.q3 = q0 / q_norm, q1 / q_norm, q2 / q_norm, q3 / q_norm

    def quaternion_wxyz(self):
        """(w, x, y, z) rotating body-frame vectors into East-North-Up (the BNO085 rotation vector convention).
        Only pitch and roll are meaningful; yaw is unreferenced."""
        # q_ENU = q_z(+90 deg) * q_NWU
        q0, q1, q2, q3 = self.q0, self.q1, self.q2, self.q3
        c = HALF_SQRT2
        w, x, y, z = c * (q0 - q3), c * (q1 - q2), c * (q2 + q1), c * (q3 + q0)
        # q and -q are the same rotation; report w >= 0, like the BNO085 examples in ../adafruit/README.md
        return (w, x, y, z) if w >= 0 else (-w, -x, -y, -z)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _scale(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def _normalized(a):
    norm = sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    return (a[0] / norm, a[1] / norm, a[2] / norm) if norm > 1e-9 else None


def _matrix_to_quaternion(r):
    """(w, x, y, z) for rotation matrix r (tuple of rows)."""
    trace = r[0][0] + r[1][1] + r[2][2]
    if trace > 0:
        s = sqrt(trace + 1.0) * 2
        return (0.25 * s, (r[2][1] - r[1][2]) / s, (r[0][2] - r[2][0]) / s, (r[1][0] - r[0][1]) / s)
    if r[0][0] > r[1][1] and r[0][0] > r[2][2]:
        s = sqrt(1.0 + r[0][0] - r[1][1] - r[2][2]) * 2
        return ((r[2][1] - r[1][2]) / s, 0.25 * s, (r[0][1] + r[1][0]) / s, (r[0][2] + r[2][0]) / s)
    if r[1][1] > r[2][2]:
        s = sqrt(1.0 + r[1][1] - r[0][0] - r[2][2]) * 2
        return ((r[0][2] - r[2][0]) / s, (r[0][1] + r[1][0]) / s, 0.25 * s, (r[1][2] + r[2][1]) / s)
    s = sqrt(1.0 + r[2][2] - r[0][0] - r[1][1]) * 2
    return ((r[1][0] - r[0][1]) / s, (r[0][2] + r[2][0]) / s, (r[1][2] + r[2][1]) / s, 0.25 * s)
