"""Empirically pin down BNO085 frame conventions and noise levels from jaiabot logs."""

import glob
import os
import sys

import numpy as np

import jaialog
from jaialog import wrap180, wrap360

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")


def quat_to_R(qw, qx, qy, qz):
    """Rotation matrices for a quaternion array, using the standard (Hamilton) convention."""
    n = np.sqrt(qw * qw + qx * qx + qy * qy + qz * qz)
    w, x, y, z = qw / n, qx / n, qy / n, qz / n
    R = np.empty((len(w), 3, 3))
    R[:, 0, 0] = 1 - 2 * (y * y + z * z)
    R[:, 0, 1] = 2 * (x * y - w * z)
    R[:, 0, 2] = 2 * (x * z + w * y)
    R[:, 1, 0] = 2 * (x * y + w * z)
    R[:, 1, 1] = 1 - 2 * (x * x + z * z)
    R[:, 1, 2] = 2 * (y * z - w * x)
    R[:, 2, 0] = 2 * (x * z - w * y)
    R[:, 2, 1] = 2 * (y * z + w * x)
    R[:, 2, 2] = 1 - 2 * (x * x + y * y)
    return R


def report_quaternion_frame(log):
    imu, tpv = log.imu, jaialog.dedupe_tpv(log.tpv)
    R = quat_to_R(imu["qw"], imu["qx"], imu["qy"], imu["qz"])

    sog = jaialog.interp_at(imu.t, tpv.t, tpv["speed"], max_gap=2.0)
    cog = jaialog.interp_at(imu.t, tpv.t, tpv["track"], max_gap=2.0)
    mode = jaialog.interp_at(imu.t, tpv.t, tpv["mode"], max_gap=2.0)
    fast = (sog > 1.2) & (mode >= jaialog.GPS_MODE_2D) & np.isfinite(cog)
    print(f"  samples with SOG>1.2 and fix: {fast.sum()} / {len(imu)}")
    if fast.sum() < 200:
        print("  not enough motion to identify frame")
        return

    # Candidate headings: azimuth of each body axis mapped into the world frame, both
    # under q (R) and under q^-1 (R^T), read as either atan2(E,N) or atan2(N,E).
    cands = {}
    for label, M in (("q", R), ("qinv", np.transpose(R, (0, 2, 1)))):
        for ax, name in ((0, "x"), (1, "y"), (2, "z")):
            v = M[:, :, ax]  # body axis `ax` expressed in the world frame
            cands[f"{label}.{name}:atan2(c0,c1)"] = np.degrees(np.arctan2(v[:, 0], v[:, 1]))
            cands[f"{label}.{name}:atan2(c1,c0)"] = np.degrees(np.arctan2(v[:, 1], v[:, 0]))

    cands["euler_heading(logged)"] = imu["heading"]

    print(f"  {'candidate':32s} {'bias':>8s} {'sd':>7s} {'|median|':>9s}")
    rows = []
    for k, h in sorted(cands.items()):
        d = wrap180(h[fast] - cog[fast])
        bias = np.degrees(np.arctan2(np.mean(np.sin(np.radians(d))), np.mean(np.cos(np.radians(d)))))
        resid = wrap180(d - bias)
        rows.append((np.std(resid), k, bias, np.median(np.abs(resid))))
    for sd, k, bias, mad in sorted(rows):
        print(f"  {k:32s} {bias:8.2f} {sd:7.2f} {mad:9.2f}")


def report_gravity_and_accel(log):
    imu = log.imu
    g = np.stack([imu["gx"], imu["gy"], imu["gz"]], axis=1)
    gn = np.linalg.norm(g, axis=1)
    print(f"  |gravity| mean={gn.mean():.4f} sd={gn.std():.4f} m/s^2")
    print(f"  gravity mean vector = [{g[:,0].mean():7.3f} {g[:,1].mean():7.3f} {g[:,2].mean():7.3f}]")

    a = np.stack([imu["ax"], imu["ay"], imu["az"]], axis=1)
    print(f"  linear_accel  mean = [{a[:,0].mean():7.4f} {a[:,1].mean():7.4f} {a[:,2].mean():7.4f}]")
    print(f"  linear_accel  sd   = [{a[:,0].std():7.4f} {a[:,1].std():7.4f} {a[:,2].std():7.4f}]")

    # Which body axis does gravity load? Tells us the mounting.
    R = quat_to_R(imu["qw"], imu["qx"], imu["qy"], imu["qz"])
    for label, M in (("q", R), ("qinv", np.transpose(R, (0, 2, 1)))):
        gw = np.einsum("nij,nj->ni", M, g)
        print(f"  gravity rotated by {label:4s} -> mean [{gw[:,0].mean():7.3f} "
              f"{gw[:,1].mean():7.3f} {gw[:,2].mean():7.3f}]  sd_xy="
              f"{np.hypot(gw[:,0],gw[:,1]).std():.3f}")


def report_static_noise(log):
    """Find the quietest window (bot at rest at surface) and measure gyro/accel noise."""
    imu = log.imu
    tpv = jaialog.dedupe_tpv(log.tpv)
    sog = jaialog.interp_at(imu.t, tpv.t, tpv["speed"], max_gap=2.0)
    w = np.stack([imu["wx"], imu["wy"], imu["wz"]], axis=1)
    a = np.stack([imu["ax"], imu["ay"], imu["az"]], axis=1)

    win = 300  # ~30 s at 10 Hz
    if len(imu) < win * 2:
        return
    energy = np.array([np.linalg.norm(w[i:i + win]) + np.linalg.norm(a[i:i + win])
                       for i in range(0, len(imu) - win, win // 2)])
    starts = np.arange(0, len(imu) - win, win // 2)
    still = [s for s, e in zip(starts, energy) if e == energy.min()]
    s = still[0]
    sl = slice(s, s + win)
    print(f"  quietest {win/10:.0f}s window at t+{imu.t[s]-log.t0:.0f}s "
          f"(SOG mean {np.nanmean(sog[sl]):.2f} m/s)")
    print(f"    gyro mean [deg/s] = [{np.degrees(w[sl,0].mean()):8.4f} "
          f"{np.degrees(w[sl,1].mean()):8.4f} {np.degrees(w[sl,2].mean()):8.4f}]")
    print(f"    gyro sd   [deg/s] = [{np.degrees(w[sl,0].std()):8.4f} "
          f"{np.degrees(w[sl,1].std()):8.4f} {np.degrees(w[sl,2].std()):8.4f}]")
    print(f"    lin-accel sd [m/s2] = [{a[sl,0].std():7.4f} {a[sl,1].std():7.4f} {a[sl,2].std():7.4f}]")
    print(f"    lin-accel mean      = [{a[sl,0].mean():7.4f} {a[sl,1].mean():7.4f} {a[sl,2].mean():7.4f}]")


def report_gps(log):
    tpv_raw, tpv = log.tpv, jaialog.dedupe_tpv(log.tpv)
    print(f"  tpv raw n={len(tpv_raw)} -> deduped n={len(tpv)} "
          f"({len(tpv)/max(tpv.t[-1]-tpv.t[0],1e-9):.2f} Hz)")
    mode = tpv["mode"]
    for m, label in ((0, "unset"), (1, "no fix"), (2, "2D"), (3, "3D")):
        n = int((mode == m).sum())
        if n:
            print(f"    mode {label:7s}: {n:6d} ({100*n/len(mode):5.1f}%)")
    for k in ("epx", "epy", "eps"):
        if tpv.has(k):
            v = tpv[k][np.isfinite(tpv[k])]
            print(f"    {k}: median={np.median(v):.2f} p90={np.percentile(v,90):.2f}")
    if log.sky is not None and len(log.sky):
        print(f"    hdop median={np.median(log.sky['hdop']):.2f} "
              f"usat median={np.median(log.sky['usat']):.0f}")


def report_speed_model(log):
    """Fit speed-over-ground against motor RPM and commanded throttle."""
    tpv = jaialog.dedupe_tpv(log.tpv)
    motor, lowctl = log.motor, log.lowctl
    if motor is None or not len(motor):
        return
    sog = jaialog.interp_at(motor.t, tpv.t, tpv["speed"], max_gap=2.0)
    mode = jaialog.interp_at(motor.t, tpv.t, tpv["mode"], max_gap=2.0)
    depth = jaialog.interp_at(motor.t, log.press.t, log.press["depth"], max_gap=2.0)
    cmd = jaialog.interp_at(motor.t, lowctl.t, lowctl["motor"], max_gap=2.0) if len(lowctl) else None
    ok = np.isfinite(sog) & (mode >= jaialog.GPS_MODE_2D) & (depth < 0.5)
    rpm = motor["rpm"]
    print(f"  usable samples: {ok.sum()}  rpm range {rpm[ok].min():.0f}..{rpm[ok].max():.0f}")
    bins = [(0, 1), (1, 500), (500, 1000), (1000, 1500), (1500, 2000), (2000, 2500),
            (2500, 3000), (3000, 3500), (3500, 4000), (4000, 1e9)]
    print(f"    {'rpm bin':>14s} {'n':>6s} {'sog mean':>9s} {'sog sd':>7s} {'cmd mean':>9s}")
    for lo, hi in bins:
        m = ok & (rpm >= lo) & (rpm < hi)
        if m.sum() < 20:
            continue
        c = np.nanmean(cmd[m]) if cmd is not None else np.nan
        print(f"    {lo:6.0f}-{hi if hi<1e9 else 9999:6.0f} {m.sum():6d} "
              f"{sog[m].mean():9.3f} {sog[m].std():7.3f} {c:9.1f}")
    m = ok & (rpm > 300)
    if m.sum() > 200:
        A = np.stack([rpm[m], np.ones(m.sum())], axis=1)
        coef, *_ = np.linalg.lstsq(A, sog[m], rcond=None)
        pred = A @ coef
        print(f"    linear fit sog = {coef[0]*1000:.4f}*(rpm/1000) + {coef[1]:.3f}  "
              f"resid sd={np.std(sog[m]-pred):.3f} m/s")


def report_heading_vs_cog(log):
    imu, tpv = log.imu, jaialog.dedupe_tpv(log.tpv)
    sog = jaialog.interp_at(imu.t, tpv.t, tpv["speed"], max_gap=2.0)
    cog = jaialog.interp_at(imu.t, tpv.t, tpv["track"], max_gap=2.0)
    for lo, hi in ((0.5, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 3.0), (3.0, 99.0)):
        m = (sog >= lo) & (sog < hi) & np.isfinite(cog)
        if m.sum() < 50:
            continue
        d = wrap180(imu["heading"][m] - cog[m])
        print(f"    SOG {lo:.1f}-{hi:.1f}: n={m.sum():6d} "
              f"hdg-cog median={np.median(d):7.2f} iqr={np.percentile(d,75)-np.percentile(d,25):6.2f} "
              f"sd={d.std():6.2f}")


def main():
    paths = sorted(glob.glob(os.path.join(LOGDIR, "*.h5")))
    if len(sys.argv) > 1:
        paths = [p for p in paths if any(a in p for a in sys.argv[1:])]
    for p in paths:
        log = jaialog.load(p)
        print("=" * 78)
        print(log.name)
        print("-- gps")
        report_gps(log)
        print("-- quaternion frame identification")
        report_quaternion_frame(log)
        print("-- gravity / accel")
        report_gravity_and_accel(log)
        print("-- static noise")
        report_static_noise(log)
        print("-- heading vs cog")
        report_heading_vs_cog(log)
        print("-- speed model")
        report_speed_model(log)
        print()


if __name__ == "__main__":
    main()
