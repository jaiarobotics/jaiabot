"""Compute the evidence behind each estimator tuning constant, for the dashboard.

Every panel this feeds answers one question: what in the data justifies this number? Where a
constant is looser than the measurement (a deliberately conservative choice) the panel shows
both so the margin is visible rather than hidden.

Parameter values are parsed out of the headers rather than restated here, so the dashboard
cannot silently drift from the code it documents.
"""

import glob
import json
import math
import os
import re
import subprocess
import sys

import numpy as np

W = os.path.expanduser("~/Projects/jaia-work")
NAV = f"{W}/jaiabot/src/lib/nav"
TOOL = f"{W}/out/nav_replay"
DECL = -13.5


# ---------------------------------------------------------------- parameters from source
def parse_params():
    out = {}
    for fn in ("attitude_filter.h", "dead_reckoner.h", "vertical_filter.h", "state_estimator.h"):
        p = os.path.join(NAV, fn)
        if not os.path.exists(p):
            continue
        for line in open(p):
            m = re.match(r"\s*(?:double|int|bool)\s+(\w+)\s*\{\s*([^}]+?)\s*\}\s*;", line)
            if not m:
                continue
            name, raw = m.group(1), m.group(2).strip()
            deg = re.match(r"deg_to_rad\(\s*([-\d.]+)\s*\)", raw)
            try:
                out[name] = dict(value=float(deg.group(1)) if deg else float(raw),
                                 unit="deg" if deg else "", file=fn)
            except ValueError:
                pass
    return out


# ---------------------------------------------------------------- csv reading
def read(path, kinds=("imu", "gnss", "motor", "pressure")):
    d = {k: [] for k in kinds}
    with open(path) as f:
        for line in f:
            if not line or line[0] == "#":
                continue
            r = line.rstrip("\n").split(",")
            if r[0] in d:
                d[r[0]].append(r[1:])
    out = {}
    for k, rows in d.items():
        if not rows:
            out[k] = np.zeros((0, 1))
            continue
        n = max(len(x) for x in rows)
        a = np.full((len(rows), n), np.nan)
        for i, row in enumerate(rows):
            for j, v in enumerate(row):
                if v not in ("", "nan"):
                    try:
                        a[i, j] = float(v)
                    except ValueError:
                        pass
        out[k] = a
    return out


def all_csvs():
    ps = []
    for d in ("csv", "csv2"):
        ps += sorted(glob.glob(f"{W}/{d}/*.csv"))
    return [p for p in ps if ".truth." not in p]


def hist(vals, lo=None, hi=None, bins=44):
    v = np.asarray(vals, dtype=float)
    v = v[np.isfinite(v)]
    if len(v) < 10:
        return None
    lo = np.percentile(v, 0.5) if lo is None else lo
    hi = np.percentile(v, 99.5) if hi is None else hi
    if hi <= lo:
        hi = lo + 1
    c, e = np.histogram(np.clip(v, lo, hi), bins=bins, range=(lo, hi))
    return dict(x=[round(float((e[i] + e[i+1]) / 2), 4) for i in range(len(c))],
                y=[int(x) for x in c],
                p50=round(float(np.median(v)), 4),
                p05=round(float(np.percentile(v, 5)), 4),
                p95=round(float(np.percentile(v, 95)), 4),
                n=int(len(v)))


# ---------------------------------------------------------------- sensor noise
def sensor_noise(paths):
    gyro, accel_mag, grav_mag, pitch_all = [], [], [], []
    for p in paths:
        d = read(p, ("imu", "pressure"))
        imu = d["imu"]
        if imu.shape[0] < 500:
            continue
        t = imu[:, 0]
        q = imu[:, 1:5]; g = imu[:, 5:8]; w = np.degrees(imu[:, 8:11])
        gm = np.linalg.norm(g, axis=1)
        grav_mag += list(gm[np.isfinite(gm)][::7])
        nq = np.linalg.norm(q, axis=1)
        ok = np.isfinite(nq) & (nq > 0.5) & (nq < 1.5)
        if ok.sum() > 100:
            qq = q[ok] / nq[ok, None]
            c0u = 2 * (qq[:, 1] * qq[:, 3] - qq[:, 0] * qq[:, 2])
            c0e = 1 - 2 * (qq[:, 2] ** 2 + qq[:, 3] ** 2)
            c0n = 2 * (qq[:, 1] * qq[:, 2] + qq[:, 0] * qq[:, 3])
            pitch_all += list(np.degrees(np.arctan2(c0u, np.hypot(c0e, c0n)))[::5])
        # quietest 30 s window: gyro white noise with the vehicle effectively still
        win = 300
        if len(w) > win * 3:
            energy = np.array([np.abs(w[i:i+win]).mean() for i in range(0, len(w) - win, win)])
            k = int(np.argmin(energy)) * win
            seg = w[k:k+win]
            # A log where the bot never actually sits still has no noise floor to measure.
            if np.nanmean(np.abs(seg)) < 0.5:
                for ax in range(3):
                    s = seg[:, ax][np.isfinite(seg[:, ax])]
                    if len(s) > 50 and s.std() > 0:
                        gyro.append(float(s.std()))
    return dict(gyro_sd=hist(gyro, 0, 0.5, 30), grav_mag=hist(grav_mag, 4, 13, 46),
                pitch=hist(pitch_all, -95, 95, 40))


# ---------------------------------------------------------------- gnss quality
def gnss_quality(paths):
    scatter, sog_step, still_pos = [], [], []
    for p in paths:
        d = read(p, ("gnss", "motor", "pressure"))
        g = d["gnss"]
        if g.shape[0] < 500:
            continue
        t, lat, lon, mode = g[:, 0], g[:, 1], g[:, 2], g[:, 3]
        sog = g[:, 4] if g.shape[1] > 4 else np.full(len(t), np.nan)
        fix = mode >= 3
        if fix.sum() < 300:
            continue
        ds = np.diff(sog[fix]); dt = np.diff(t[fix])
        sel = np.isfinite(ds) & (dt > 0.15) & (dt < 0.4)
        sog_step += list(ds[sel][::3])
        # stationary runs: rpm ~ 0, at the surface, low reported speed
        m = d["motor"]; pr = d["pressure"]
        if m.shape[0] < 10 or pr.shape[0] < 10:
            continue
        rpm = np.interp(t, m[:, 0], m[:, 1])
        dep = np.interp(t, pr[:, 0], pr[:, 1])
        still = fix & (np.abs(rpm) < 50) & (dep < 0.4) & (sog < 0.5)
        idx = np.flatnonzero(still)
        if len(idx) < 200:
            continue
        lat0, lon0 = np.median(lat[still]), np.median(lon[still])
        e = np.radians(lon[still] - lon0) * 6371000 * math.cos(math.radians(lat0))
        n = np.radians(lat[still] - lat0) * 6371000
        grp = ((t[still] - t[still][0]) // 60).astype(int)
        for gi in np.unique(grp):
            s = grp == gi
            if s.sum() < 100:
                continue
            scatter.append(round(float(np.hypot(e[s].std(), n[s].std())), 3))
        keep = slice(0, 900)
        still_pos += [[round(float(a), 2), round(float(b), 2)] for a, b in zip(e[keep], n[keep])]
    return dict(still_scatter=hist(scatter, 0, 6, 30), sog_step=hist(sog_step, -1, 1, 40),
                still_pos=still_pos[:2500])


# ---------------------------------------------------------------- motion model
def motion_model(paths):
    """Per-window joint fit of speed-through-water and current; also the surge step response."""
    pts, currents, taus = [], [], []
    for p in paths:
        d = read(p, ("imu", "gnss", "motor", "pressure"))
        imu, g, m, pr = d["imu"], d["gnss"], d["motor"], d["pressure"]
        if imu.shape[0] < 500 or g.shape[0] < 300 or m.shape[0] < 100:
            continue
        it = imu[:, 0]; q = imu[:, 1:5]
        nq = np.linalg.norm(q, axis=1)
        ok = np.isfinite(nq) & (nq > 0.5) & (nq < 1.5)
        if ok.sum() < 300:
            continue
        it = it[ok]; qq = q[ok] / nq[ok, None]
        c0e = 1 - 2 * (qq[:, 2] ** 2 + qq[:, 3] ** 2)
        c0n = 2 * (qq[:, 1] * qq[:, 2] + qq[:, 0] * qq[:, 3])
        hdg = (np.degrees(np.arctan2(c0e, c0n)) + DECL) % 360.0
        fix = g[:, 3] >= 3
        if fix.sum() < 200:
            continue
        gt = g[fix, 0]; sog = g[fix, 4] if g.shape[1] > 4 else np.full(fix.sum(), np.nan)
        cog = g[fix, 5] if g.shape[1] > 5 else np.full(fix.sum(), np.nan)
        S = np.interp(it, gt, sog); C = np.interp(it, gt, cog)
        RPM = np.interp(it, m[:, 0], m[:, 1])
        DEP = np.interp(it, pr[:, 0], pr[:, 1]) if pr.shape[0] > 10 else np.zeros(len(it))
        cr = np.radians(C)
        ve, vn = S * np.sin(cr), S * np.cos(cr)
        base = np.isfinite(ve) & np.isfinite(RPM) & (DEP < 0.5) & (S > 0.4)
        u = np.stack([np.sin(np.radians(hdg)), np.cos(np.radians(hdg))], 1)
        for t0 in np.arange(it[0], it[-1], 240.0):
            sel = base & (it >= t0) & (it < t0 + 240)
            if sel.sum() < 200:
                continue
            h = np.radians(hdg[sel])
            r = math.hypot(np.mean(np.sin(h)), np.mean(np.cos(h)))
            if math.degrees(2 * math.acos(min(1, r))) < 70:
                continue
            n = int(sel.sum())
            A = np.zeros((2 * n, 3))
            A[:n, 0] = u[sel, 0]; A[:n, 1] = 1.0
            A[n:, 0] = u[sel, 1]; A[n:, 2] = 1.0
            b = np.concatenate([ve[sel], vn[sel]])
            sol, *_ = np.linalg.lstsq(A, b, rcond=None)
            stw, ce, cn = sol
            if not (0.1 < stw < 4.0):
                continue
            currents.append(round(float(math.hypot(ce, cn)), 3))
            # speed through water against rpm, current removed
            resid_e = ve[sel] - ce; resid_n = vn[sel] - cn
            proj = resid_e * u[sel, 0] + resid_n * u[sel, 1]
            rp = RPM[sel]
            for lo in range(0, 4000, 250):
                b2 = (np.abs(rp) >= lo) & (np.abs(rp) < lo + 250)
                if b2.sum() < 25:
                    continue
                pts.append([int(lo + 125), round(float(np.median(proj[b2])), 3)])
    return dict(rpm_stw=pts[:4000], current_mag=hist(currents, 0, 1.2, 30))


# ---------------------------------------------------------------- spin validation
def spin_validation(paths):
    out = []
    for p in paths:
        with open(p) as f:
            head = f.readline() + f.readline() + f.readline() + f.readline()
        d = read(p, ("imu", "pressure"))
        imu, pr = d["imu"], d["pressure"]
        if imu.shape[1] < 15 or imu.shape[0] < 500 or pr.shape[0] < 100:  # needs 12:15
            continue
        t = imu[:, 0]; g = imu[:, 5:8]; w = np.degrees(imu[:, 8:11]); B = imu[:, 12:15]
        if not np.isfinite(B).any():
            continue
        dep = np.interp(t, pr[:, 0], pr[:, 1])
        pitch = np.degrees(np.arctan2(g[:, 0], np.hypot(g[:, 1], g[:, 2])))
        dr = np.gradient(dep, t)
        hold = (dep > 1.0) & (np.abs(dr) < 0.05) & (np.abs(pitch) > 70)
        phi = np.unwrap(np.arctan2(B[:, 2], B[:, 1]))
        rate = np.degrees(np.gradient(phi, t))
        dt = np.diff(t, prepend=t[0])
        sel = hold & (dt > 0.06) & (dt < 0.25) & np.isfinite(rate)
        if sel.sum() < 300:
            continue
        gx, rm = w[sel, 0], -rate[sel]
        keep = np.isfinite(gx) & np.isfinite(rm) & (np.abs(gx) < 200) & (np.abs(rm) < 200)
        out.append(dict(log=os.path.basename(p)[:-4],
                        pts=[[round(float(a), 1), round(float(b), 1)] for a, b in
                             list(zip(gx[keep], rm[keep]))[::3]][:1200],
                        corr=round(float(np.corrcoef(gx[keep], rm[keep])[0, 1]), 3),
                        gyro_mean=round(float(gx[keep].mean()), 2),
                        mag_mean=round(float(rm[keep].mean()), 2)))
    return out


# ---------------------------------------------------------------- performance
def performance(paths):
    trials = []
    for H in (15, 30, 45, 60, 90, 120):
        for p in paths:
            r = subprocess.run([TOOL, "--log", p, "--horizon", str(H), "--stride", "20",
                                "--min-distance", "5", "--verbose"],
                               capture_output=True, text=True)
            for line in r.stdout.split("start")[-1].splitlines():
                f = line.split()
                if len(f) < 9:
                    continue
                try:
                    pl, dp, er, fz, al, cr, sg = (float(f[1]), float(f[2]), float(f[3]),
                                                  float(f[4]), float(f[5]), float(f[6]), float(f[7]))
                except ValueError:
                    continue
                if sg < 0.8 or dp <= 0 or pl <= 0:
                    continue
                if dp / H >= 1.0 and dp / pl >= 0.7:
                    trials.append([dp, er, fz, H])
    a = np.array(trials) if trials else np.zeros((0, 4))
    curve = []
    for lo, hi in ((10, 20), (20, 30), (30, 45), (45, 60), (60, 90), (90, 140)):
        m = (a[:, 0] >= lo) & (a[:, 0] < hi)
        if m.sum() < 25:
            continue
        curve.append(dict(lo=lo, hi=hi, n=int(m.sum()),
                          cep=round(float(np.percentile(a[m, 1], 50)), 1),
                          r95=round(float(np.percentile(a[m, 1], 95)), 1),
                          frozen=round(float(np.percentile(a[m, 2], 50)), 1)))
    return dict(runin=curve, n_trials=int(len(a)))


def main():
    paths = all_csvs()
    print(f"{len(paths)} logs", flush=True)
    ev = {"params": parse_params(), "n_logs": len(paths)}
    for name, fn in (("noise", sensor_noise), ("gnss", gnss_quality),
                     ("motion", motion_model), ("spin", spin_validation)):
        print("computing", name, flush=True)
        ev[name] = fn(paths)
    print("computing performance (runs nav_replay across all logs)", flush=True)
    ev["perf"] = performance(paths)
    out = f"{W}/analysis/evidence.json"
    json.dump(ev, open(out, "w"), separators=(",", ":"), allow_nan=False,
              default=lambda o: None)
    print(f"wrote {out} ({os.path.getsize(out)/1e6:.2f} MB)")
    print("params parsed:", len(ev["params"]))


if __name__ == "__main__":
    main()
