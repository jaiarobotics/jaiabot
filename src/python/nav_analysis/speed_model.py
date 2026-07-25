"""Identify a speed-through-water model and water current from GPS + heading + RPM.

Physical model, horizontal only:

    v_ground = stw(rpm) * u(heading) + current

`stw` is speed through water along the vehicle's forward axis, `u` the unit heading
vector. With GPS available every term but `stw` and `current` is observed, so a window
in which the vehicle changes heading identifies both (the classic current triangle).
"""

import glob
import os

import numpy as np

import jaialog
from frames import valid_quat_mask

LOGDIR = os.path.expanduser("~/Projects/jaia-work/logs")
DECLINATION_DEG = -13.5  # Narragansett Bay area, 2025; magnetic -> true


def build_frame(log, declination_deg=DECLINATION_DEG):
    """Resample everything onto the IMU clock, in true-north ENU."""
    imu = log.imu.subset(valid_quat_mask(log.imu))
    tpv = jaialog.dedupe_tpv(log.tpv)

    hdg_true = np.radians((imu["heading"] + declination_deg) % 360.0)
    sog = jaialog.interp_at(imu.t, tpv.t, tpv["speed"], max_gap=1.5)
    cog = jaialog.interp_at(imu.t, tpv.t, tpv["track"], max_gap=1.5)
    mode = jaialog.interp_at(imu.t, tpv.t, tpv["mode"], max_gap=1.5)
    rpm = jaialog.interp_at(imu.t, log.motor.t, log.motor["rpm"], max_gap=1.5)
    depth = jaialog.interp_at(imu.t, log.press.t, log.press["depth"], max_gap=1.5)

    cog_rad = np.radians(cog)
    # Heading unit vector and GPS ground velocity, both as (east, north).
    u = np.stack([np.sin(hdg_true), np.cos(hdg_true)], axis=1)
    vg = np.stack([sog * np.sin(cog_rad), sog * np.cos(cog_rad)], axis=1)

    return dict(t=imu.t, u=u, vg=vg, sog=sog, cog=cog, mode=mode, rpm=rpm,
                depth=depth, hdg=np.degrees(hdg_true), imu=imu)


def fit_windowed(fr, window_s=240.0, min_heading_spread_deg=60.0):
    """Per-window joint least squares for a linear stw(rpm) and a constant current."""
    t, u, vg, rpm = fr["t"], fr["u"], fr["vg"], fr["rpm"]
    good = (np.isfinite(vg[:, 0]) & np.isfinite(rpm) & (fr["mode"] >= jaialog.GPS_MODE_2D)
            & (fr["depth"] < 0.5) & (rpm > 800))
    out = []
    t_start = t[0]
    while t_start < t[-1]:
        m = good & (t >= t_start) & (t < t_start + window_s)
        t_start += window_s
        if m.sum() < 150:
            continue
        hdg = fr["hdg"][m]
        spread = np.degrees(np.arccos(np.clip(
            np.hypot(np.mean(np.sin(np.radians(hdg))), np.mean(np.cos(np.radians(hdg)))), 0, 1))) * 2
        if spread < min_heading_spread_deg:
            continue
        # Unknowns: [k, c, current_e, current_n] with stw = k*rpm/1000 + c
        n = m.sum()
        A = np.zeros((2 * n, 4))
        b = np.concatenate([vg[m, 0], vg[m, 1]])
        A[:n, 0] = u[m, 0] * rpm[m] / 1000.0
        A[:n, 1] = u[m, 0]
        A[:n, 2] = 1.0
        A[n:, 0] = u[m, 1] * rpm[m] / 1000.0
        A[n:, 1] = u[m, 1]
        A[n:, 3] = 1.0
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
        resid = b - A @ sol
        out.append(dict(t0=t[m][0], n=n, spread=spread, k=sol[0], c=sol[1],
                        cur=np.array([sol[2], sol[3]]), resid_sd=resid.std()))
    return out


def fit_global(fr, use_current=True):
    """One stw(rpm) for the whole log, with a current per 300 s block if enabled."""
    t, u, vg, rpm = fr["t"], fr["u"], fr["vg"], fr["rpm"]
    good = (np.isfinite(vg[:, 0]) & np.isfinite(rpm) & (fr["mode"] >= jaialog.GPS_MODE_2D)
            & (fr["depth"] < 0.5) & (rpm > 800))
    idx = np.flatnonzero(good)
    if len(idx) < 300:
        return None
    block = ((t[idx] - t[0]) // 300).astype(int)
    nb = block.max() + 1
    n = len(idx)
    ncur = 2 * nb if use_current else 0
    A = np.zeros((2 * n, 2 + ncur))
    b = np.concatenate([vg[idx, 0], vg[idx, 1]])
    A[:n, 0] = u[idx, 0] * rpm[idx] / 1000.0
    A[:n, 1] = u[idx, 0]
    A[n:, 0] = u[idx, 1] * rpm[idx] / 1000.0
    A[n:, 1] = u[idx, 1]
    if use_current:
        A[np.arange(n), 2 + 2 * block] = 1.0
        A[n + np.arange(n), 2 + 2 * block + 1] = 1.0
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    resid = b - A @ sol
    cur = sol[2:].reshape(-1, 2) if use_current else np.zeros((0, 2))
    return dict(k=sol[0], c=sol[1], cur=cur, resid_sd=resid.std(), n=n,
                resid_p90=np.percentile(np.abs(resid), 90))


def main():
    for p in sorted(glob.glob(os.path.join(LOGDIR, "*.h5"))):
        log = jaialog.load(p)
        fr = build_frame(log)
        print("=" * 78)
        print(log.name)

        for label, use_cur in (("no current", False), ("with current/300s", True)):
            g = fit_global(fr, use_current=use_cur)
            if g is None:
                print("  insufficient data")
                continue
            print(f"  global fit {label:18s}: stw = {g['k']:.4f}*(rpm/1000) + {g['c']:+.3f}  "
                  f"resid sd={g['resid_sd']:.3f} p90={g['resid_p90']:.3f} m/s  n={g['n']}")
            if use_cur and len(g["cur"]):
                mag = np.linalg.norm(g["cur"], axis=1)
                print(f"    current magnitude over blocks: median={np.median(mag):.3f} "
                      f"max={mag.max():.3f} m/s")

        wins = fit_windowed(fr)
        print(f"  windowed fits (240 s, heading spread > 60 deg): {len(wins)}")
        for w in wins:
            print(f"    t+{w['t0']-fr['t'][0]:6.0f}s n={w['n']:5d} spread={w['spread']:5.1f} "
                  f"stw={w['k']:.4f}*krpm{w['c']:+.3f} cur=[{w['cur'][0]:+.2f},{w['cur'][1]:+.2f}] "
                  f"|cur|={np.linalg.norm(w['cur']):.2f} resid={w['resid_sd']:.3f}")


if __name__ == "__main__":
    main()
