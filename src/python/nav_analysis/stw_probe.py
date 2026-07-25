"""Isolate the current-triangle physics from the rpm->speed map.

Per window we fit only three unknowns - a constant speed through water and a constant
current - using the true world-frame forward axis (so pitch is handled properly). If the
residual collapses, the kinematics are right and only the rpm map needs work.
"""

import glob
import os

import numpy as np

import jaialog
from frames import quat_to_R, valid_quat_mask

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")
DECLINATION_DEG = -13.5


def build(log):
    imu = log.imu.subset(valid_quat_mask(log.imu))
    tpv = jaialog.dedupe_tpv(log.tpv)
    tpv = tpv.subset(tpv["mode"] >= jaialog.GPS_MODE_3D)
    R = quat_to_R(imu["qw"], imu["qx"], imu["qy"], imu["qz"])

    # Body forward axis in the magnetic ENU frame, then rotated to true north.
    fwd = R[:, :, 0]
    dec = np.radians(DECLINATION_DEG)
    c, s = np.cos(dec), np.sin(dec)
    # Rotating the frame by declination about Up: bearing increases by `dec`.
    fe = fwd[:, 0] * c + fwd[:, 1] * s
    fn = -fwd[:, 0] * s + fwd[:, 1] * c
    fwd_h = np.stack([fe, fn], axis=1)  # horizontal part, NOT normalised: |.| = cos(pitch)

    sog = jaialog.interp_at(imu.t, tpv.t, tpv["speed"], max_gap=1.0)
    cog = jaialog.interp_at(imu.t, tpv.t, tpv["track"], max_gap=1.0)
    cr = np.radians(cog)
    vg = np.stack([sog * np.sin(cr), sog * np.cos(cr)], axis=1)
    rpm = jaialog.interp_at(imu.t, log.motor.t, log.motor["rpm"], max_gap=1.0)
    depth = jaialog.interp_at(imu.t, log.press.t, log.press["depth"], max_gap=1.0)
    yawrate = np.degrees(imu["wz"])
    pitch = imu["pitch"]
    return dict(t=imu.t, fwd_h=fwd_h, vg=vg, sog=sog, rpm=rpm, depth=depth,
                yawrate=yawrate, pitch=pitch, coslat=np.linalg.norm(fwd_h, axis=1))


def fit_window(fr, m, use_pitch=True):
    """Least squares for [stw, cur_e, cur_n] over the selected samples."""
    n = int(m.sum())
    d = fr["fwd_h"][m] if use_pitch else (
        fr["fwd_h"][m] / np.linalg.norm(fr["fwd_h"][m], axis=1, keepdims=True))
    A = np.zeros((2 * n, 3))
    A[:n, 0] = d[:, 0]
    A[:n, 1] = 1.0
    A[n:, 0] = d[:, 1]
    A[n:, 2] = 1.0
    b = np.concatenate([fr["vg"][m, 0], fr["vg"][m, 1]])
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    resid = b - A @ sol
    return sol, resid.std()


def main():
    for p in sorted(glob.glob(os.path.join(LOGDIR, "*.h5"))):
        log = jaialog.load(p)
        fr = build(log)
        t = fr["t"]
        base = (np.isfinite(fr["vg"][:, 0]) & np.isfinite(fr["rpm"]) & np.isfinite(fr["depth"])
                & (fr["depth"] < 0.5))
        print("=" * 78)
        print(log.name)
        print(f"  {'t+':>7s} {'n':>5s} {'rpm':>6s} {'|pitch|':>8s} {'stw':>6s} {'|cur|':>6s} "
              f"{'res_pitch':>10s} {'res_flat':>9s}")
        rows = 0
        for t0 in np.arange(t[0], t[-1], 120.0):
            m = base & (t >= t0) & (t < t0 + 120.0)
            # Require a steady throttle, meaningful thrust and low turn rate.
            if m.sum() < 200:
                continue
            m = m & (np.abs(fr["yawrate"]) < 8.0)
            if m.sum() < 150:
                continue
            rpm_w = fr["rpm"][m]
            if rpm_w.mean() < 800 or rpm_w.std() > 400:
                continue
            sol_p, res_p = fit_window(fr, m, use_pitch=True)
            sol_f, res_f = fit_window(fr, m, use_pitch=False)
            print(f"  {t0-t[0]:7.0f} {m.sum():5d} {rpm_w.mean():6.0f} "
                  f"{np.abs(fr['pitch'][m]).mean():8.1f} {sol_p[0]:6.2f} "
                  f"{np.hypot(sol_p[1],sol_p[2]):6.2f} {res_p:10.3f} {res_f:9.3f}")
            rows += 1
        if rows == 0:
            print("  no windows met the steady-state criteria")


if __name__ == "__main__":
    main()
