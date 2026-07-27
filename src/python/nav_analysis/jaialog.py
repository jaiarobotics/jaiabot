"""Reader for jaiabot HDF5 logs, reduced to the channels a state estimator needs."""

import os
from dataclasses import dataclass, field

import h5py
import numpy as np

IMU = "jaiabot::imu/jaiabot.protobuf.IMUData"
TPV = "goby::middleware::groups::gpsd::tpv/goby.middleware.protobuf.gpsd.TimePositionVelocity"
SKY = "goby::middleware::groups::gpsd::sky/goby.middleware.protobuf.gpsd.SkyView"
MOTOR = "jaiabot::motor_status/jaiabot.protobuf.Motor"
LOWCTL = "jaiabot::low_control/jaiabot.protobuf.LowControl"
SETPT = "jaiabot::desired_setpoints/jaiabot.protobuf.DesiredSetpoints"
PRESS = "jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData"
BOTSTAT = "jaiabot::bot_status;14/jaiabot.protobuf.BotStatus"
NAVSOL = "jaiabot::nav_solution/jaiabot.protobuf.NavSolution"

GPS_MODE_NO_FIX, GPS_MODE_2D, GPS_MODE_3D = 1, 2, 3


def _get(f, path, default=None):
    return f[path][:] if path in f else default


@dataclass
class Channel:
    t: np.ndarray
    data: dict = field(default_factory=dict)

    def __len__(self):
        return len(self.t)

    def __getitem__(self, k):
        return self.data[k]

    def has(self, k):
        return k in self.data

    def keys(self):
        return sorted(self.data)

    def subset(self, mask):
        return Channel(self.t[mask], {k: v[mask] for k, v in self.data.items()})


def _channel(f, group, fields):
    """`fields` maps a stable name to a path, or to a tuple of candidate paths. Candidates
    exist because field names have been renamed across firmware versions - notably
    PressureAdjustedData.calculated_depth became sensor_depth plus a separate vehicle depth."""
    if group + "/_utime_" not in f:
        return None
    t = f[group + "/_utime_"][:].astype(np.float64) / 1e6
    data = {}
    for name, path in fields.items():
        for candidate in (path if isinstance(path, tuple) else (path,)):
            v = _get(f, group + "/" + candidate)
            if v is not None:
                data[name] = v.astype(np.float64)
                break
    return Channel(t, data)


IMU_FIELDS = {
    "qw": "quaternion/w", "qx": "quaternion/x", "qy": "quaternion/y", "qz": "quaternion/z",
    "heading": "euler_angles/heading", "pitch": "euler_angles/pitch", "roll": "euler_angles/roll",
    "ax": "linear_acceleration/x", "ay": "linear_acceleration/y", "az": "linear_acceleration/z",
    "gx": "gravity/x", "gy": "gravity/y", "gz": "gravity/z",
    "wx": "angular_velocity/x", "wy": "angular_velocity/y", "wz": "angular_velocity/z",
    "mx": "magnetic_field/x", "my": "magnetic_field/y", "mz": "magnetic_field/z",
    "rax": "acceleration/x", "ray": "acceleration/y", "raz": "acceleration/z",
    "acc_mag": "accuracies/magnetometer", "acc_gyro": "accuracies/gyroscope",
    "acc_accel": "accuracies/accelerometer", "calib_state": "calibration_state",
    "rolled_over": "bot_rolled_over",
}

TPV_FIELDS = {
    "lat": "location/lat", "lon": "location/lon", "alt": "location/altitude",
    "speed": "speed", "track": "track", "climb": "climb", "mode": "mode",
    "epx": "epx", "epy": "epy", "eps": "eps", "epd": "epd", "gps_time": "time",
}

SKY_FIELDS = {"hdop": "hdop", "pdop": "pdop", "nsat": "nsat", "usat": "usat", "vdop": "vdop"}
MOTOR_FIELDS = {"rpm": "rpm", "harness": "motor_harness_type"}
LOWCTL_FIELDS = {"motor": "control_surfaces/motor", "rudder": "control_surfaces/rudder",
                 "port_elev": "control_surfaces/port_elevator", "stbd_elev": "control_surfaces/stbd_elevator"}
SETPT_FIELDS = {"throttle": "throttle", "type": "type", "des_heading": "helm_course/heading",
                "des_speed": "helm_course/speed", "des_depth": "helm_course/depth",
                "rc_heading": "remote_control/heading", "rc_speed": "remote_control/speed",
                "is_helm_constant_course": "is_helm_constant_course"}
# Vehicle depth preferred; `calculated_depth` is the pre-rename name, `sensor_depth` is at the
# transducer. Newer firmware publishes `depth` and `sensor_depth` separately.
PRESS_FIELDS = {"depth": ("depth", "calculated_depth", "sensor_depth"),
                "pressure": "pressure_adjusted", "pressure_raw": "pressure_raw"}
BOTSTAT_FIELDS = {"lat": "location/lat", "lon": "location/lon", "heading": "attitude/heading",
                  "cog": "attitude/course_over_ground", "pitch": "attitude/pitch", "roll": "attitude/roll",
                  "sog": "speed/over_ground", "depth": "depth", "mission_state": "mission_state",
                  "hdop": "hdop", "pdop": "pdop", "bot_id": "bot_id", "calib_status": "calibration_status"}
# The estimator's own output, present in any log recorded while jaiabot_state_estimator was running.
# Reading it back matters because a log then contains both the raw inputs and what the application
# actually produced from them on the vehicle - the replay-bench comparison, but with real hardware
# sample timing rather than the bench's, which is the open question the bench could not answer.
NAVSOL_FIELDS = {"mode": "mode", "lat": "location/lat", "lon": "location/lon",
                 "sigma": "position_sigma", "heading": "attitude/heading",
                 "heading_sigma": "attitude/heading_sigma", "pitch": "attitude/pitch",
                 "roll": "attitude/roll", "sog": "speed/over_ground", "stw": "speed/over_water",
                 "cur_e": "current/east", "cur_n": "current/north", "speed_scale": "speed_scale",
                 "heading_bias": "heading_bias", "dr_distance": "dead_reckoned_distance",
                 "gnss_fix_age": "gnss_fix_age", "depth": "depth", "depth_rate": "depth_rate",
                 "declination": "magnetic_declination", "attitude_valid": "attitude_valid",
                 "position_valid": "position_valid"}


@dataclass
class JaiaLog:
    name: str
    imu: Channel
    tpv: Channel
    sky: Channel
    motor: Channel
    lowctl: Channel
    setpt: Channel
    press: Channel
    botstat: Channel
    # Absent from every log recorded before the estimator was deployed, so always check len().
    navsol: Channel = None

    @property
    def t0(self):
        return min(c.t[0] for c in self.channels() if len(c))

    def channels(self):
        return [c for c in (self.imu, self.tpv, self.sky, self.motor, self.lowctl, self.setpt,
                            self.press, self.botstat, self.navsol) if c is not None]

    def summary(self):
        lines = [f"{self.name}"]
        for label, c in [("imu", self.imu), ("tpv", self.tpv), ("sky", self.sky), ("motor", self.motor),
                         ("lowctl", self.lowctl), ("setpt", self.setpt), ("press", self.press),
                         ("botstat", self.botstat), ("navsol", self.navsol)]:
            if c is None or not len(c):
                lines.append(f"  {label:8s} absent")
                continue
            dur = c.t[-1] - c.t[0]
            lines.append(f"  {label:8s} n={len(c):7d} {dur:7.0f}s {len(c)/max(dur,1e-9):6.2f}Hz "
                         f"fields={','.join(c.keys())}")
        return "\n".join(lines)


def load(path):
    with h5py.File(path, "r") as f:
        return JaiaLog(
            name=os.path.basename(path),
            imu=_channel(f, IMU, IMU_FIELDS),
            tpv=_channel(f, TPV, TPV_FIELDS),
            sky=_channel(f, SKY, SKY_FIELDS),
            motor=_channel(f, MOTOR, MOTOR_FIELDS),
            lowctl=_channel(f, LOWCTL, LOWCTL_FIELDS),
            setpt=_channel(f, SETPT, SETPT_FIELDS),
            press=_channel(f, PRESS, PRESS_FIELDS),
            botstat=_channel(f, BOTSTAT, BOTSTAT_FIELDS),
            navsol=_channel(f, NAVSOL, NAVSOL_FIELDS),
        )


def dedupe_tpv(tpv, min_dt=0.2):
    """gpsd republishes each epoch several times; keep the last report per epoch."""
    if not len(tpv):
        return tpv
    keep = np.ones(len(tpv), dtype=bool)
    if tpv.has("gps_time"):
        gt = tpv["gps_time"]
        keep[:-1] = gt[1:] != gt[:-1]
    else:
        keep[:-1] = np.diff(tpv.t) > min_dt
    return tpv.subset(keep)


def interp_at(t_query, t_src, v_src, max_gap=None):
    """Nearest-preceding-sample interpolation with optional staleness masking."""
    idx = np.searchsorted(t_src, t_query, side="right") - 1
    valid = idx >= 0
    idx = np.clip(idx, 0, len(t_src) - 1)
    out = v_src[idx].astype(np.float64)
    if max_gap is not None:
        valid &= (t_query - t_src[idx]) <= max_gap
    out[~valid] = np.nan
    return out


def wrap180(deg):
    return (np.asarray(deg) + 180.0) % 360.0 - 180.0


def wrap360(deg):
    return np.asarray(deg) % 360.0
