"""Flatten a jaiabot HDF5 log into the CSV the nav_replay tool consumes.

One row per message, sorted by time, so the replay tool sees the same interleaving the
estimator would see live.

    type,time,f0..f7

    imu       time qw qx qy qz gx gy gz wx wy wz mag_acc   (quaternion, gravity, gyro)
    gnss      time lat lon mode sog cog
    motor     time rpm
    pressure  time depth
"""

import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jaialog
from frames import valid_quat_mask

NAN = float("nan")


def rows_for(log):
    rows = []

    imu = log.imu.subset(valid_quat_mask(log.imu))
    for i in range(len(imu)):
        rows.append(("imu", imu.t[i],
                     imu["qw"][i], imu["qx"][i], imu["qy"][i], imu["qz"][i],
                     imu["gx"][i], imu["gy"][i], imu["gz"][i],
                     imu["wx"][i], imu["wy"][i], imu["wz"][i],
                     imu["acc_mag"][i] if imu.has("acc_mag") else 3))

    tpv = jaialog.dedupe_tpv(log.tpv)
    for i in range(len(tpv)):
        sog = tpv["speed"][i] if tpv.has("speed") else NAN
        cog = tpv["track"][i] if tpv.has("track") else NAN
        rows.append(("gnss", tpv.t[i], tpv["lat"][i], tpv["lon"][i], tpv["mode"][i], sog, cog))

    if log.motor is not None and len(log.motor):
        for i in range(len(log.motor)):
            rows.append(("motor", log.motor.t[i], log.motor["rpm"][i]))

    if log.press is not None and len(log.press):
        for i in range(len(log.press)):
            rows.append(("pressure", log.press.t[i], log.press["depth"][i]))

    rows.sort(key=lambda r: r[1])
    return rows


def truth_rows(log):
    """GNSS-derived reference track, for scoring. Only 3D fixes."""
    tpv = jaialog.dedupe_tpv(log.tpv)
    tpv = tpv.subset(tpv["mode"] >= jaialog.GPS_MODE_3D)
    return [("truth", tpv.t[i], tpv["lat"][i], tpv["lon"][i]) for i in range(len(tpv))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("h5")
    ap.add_argument("out")
    args = ap.parse_args()

    log = jaialog.load(args.h5)
    rows = rows_for(log)
    truth = truth_rows(log)

    # Times are Unix epoch, so they need microsecond absolute precision, not 9 significant
    # digits -- at 1.75e9 seconds that would quantise to whole seconds. Latitude and longitude
    # likewise need enough digits to preserve sub-metre resolution.
    with open(args.out, "w") as f:
        f.write("# type,time,fields...\n")
        for r in rows:
            f.write(",".join([r[0], f"{r[1]:.6f}"] + [f"{v:.10g}" for v in r[2:]]) + "\n")

    truth_path = os.path.splitext(args.out)[0] + ".truth.csv"
    with open(truth_path, "w") as f:
        f.write("# time,lat,lon\n")
        for r in truth:
            f.write(f"{r[1]:.6f},{r[2]:.9f},{r[3]:.9f}\n")

    counts = {}
    for r in rows:
        counts[r[0]] = counts.get(r[0], 0) + 1
    print(f"{os.path.basename(args.h5)} -> {args.out}: {counts}, truth={len(truth)}")
    has_mag = log.imu.has("mx")
    print(f"  magnetic_field present: {has_mag}")


if __name__ == "__main__":
    main()
