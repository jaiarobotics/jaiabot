"""Generate a self-contained offline HTML dashboard from jaiabot replay CSVs.

Design notes that matter for correctness of the picture, not just its looks:

- Body rates oscillate at ~1.7 Hz. Decimating them to one point per second would alias
  that away and make a +/-70 deg/s oscillation look like a quiet line, so rate series
  are emitted as a per-bin min/max envelope plus the mean. The band carries the
  amplitude; the line carries the sustained component.
- Smooth channels (depth, pitch, heading, course, speed, rpm) are decimated by nearest
  sample, which is faithful for signals with no content above the bin rate.
- Heading and course wrap at 360. A break is inserted whenever consecutive samples jump
  more than 180 degrees, so the wrap does not draw a vertical streak across the panel.
- rpm and speed are never plotted on one pair of axes. Two measures with different units
  on shared y-scales invent a correlation; they get separate panels and a scatter.
"""

import glob
import json
import math
import os
import re
import sys

import numpy as np

DECLINATION_DEG = -13.5
TARGET_POINTS = 1400
R_EARTH = 6371000.0


def load_csv(path):
    imu_t, quat, grav, gyro, mag = [], [], [], [], []
    g_t, g_lat, g_lon, g_mode, g_sog, g_cog = [], [], [], [], [], []
    m_t, m_rpm, p_t, p_depth = [], [], [], []
    with open(path) as f:
        for line in f:
            if not line or line[0] == "#":
                continue
            r = line.rstrip("\n").split(",")
            k = r[0]
            try:
                if k == "imu" and len(r) >= 12:
                    imu_t.append(float(r[1]))
                    quat.append((float(r[2]), float(r[3]), float(r[4]), float(r[5])))
                    grav.append((float(r[6]), float(r[7]), float(r[8])))
                    gyro.append((float(r[9]), float(r[10]), float(r[11])))
                    mag.append(len(r) >= 16)
                elif k == "gnss" and len(r) >= 5:
                    g_t.append(float(r[1])); g_lat.append(float(r[2])); g_lon.append(float(r[3]))
                    g_mode.append(float(r[4]))
                    g_sog.append(float(r[5]) if len(r) > 5 and r[5] not in ("", "nan") else math.nan)
                    g_cog.append(float(r[6]) if len(r) > 6 and r[6] not in ("", "nan") else math.nan)
                elif k == "motor" and len(r) >= 3:
                    m_t.append(float(r[1])); m_rpm.append(float(r[2]))
                elif k == "pressure" and len(r) >= 3:
                    p_t.append(float(r[1])); p_depth.append(float(r[2]))
            except ValueError:
                continue
    return dict(imu_t=np.array(imu_t), quat=np.array(quat), grav=np.array(grav),
                gyro=np.array(gyro), has_mag=bool(mag and mag[0]),
                g_t=np.array(g_t), lat=np.array(g_lat), lon=np.array(g_lon),
                mode=np.array(g_mode), sog=np.array(g_sog), cog=np.array(g_cog),
                m_t=np.array(m_t), rpm=np.array(m_rpm),
                p_t=np.array(p_t), depth=np.array(p_depth))


def heading_pitch_roll(quat, grav):
    n = np.linalg.norm(quat, axis=1, keepdims=True)
    n[n == 0] = 1.0
    w, x, y, z = (quat / n).T
    fwd_e = 2 * (x * y + w * z)
    fwd_n = 1 - 2 * (x * x + z * z)
    # Body X in world: column 0 of the rotation matrix. heading = bearing of that axis.
    c0e = 1 - 2 * (y * y + z * z)
    c0n = 2 * (x * y + w * z)
    c0u = 2 * (x * z - w * y)
    heading = (np.degrees(np.arctan2(c0e, c0n)) + DECLINATION_DEG) % 360.0
    pitch = np.degrees(np.arctan2(c0u, np.hypot(c0e, c0n)))
    roll = np.degrees(np.arctan2(grav[:, 1], grav[:, 2]))
    del fwd_e, fwd_n
    return heading, pitch, roll


def decimate_nearest(t_src, v_src, grid):
    if len(t_src) == 0:
        return [None] * len(grid)
    idx = np.clip(np.searchsorted(t_src, grid), 0, len(t_src) - 1)
    out = v_src[idx].astype(float)
    stale = np.abs(t_src[idx] - grid) > max(5.0, (grid[1] - grid[0]) * 4 if len(grid) > 1 else 5.0)
    out[stale] = np.nan
    return [None if not np.isfinite(x) else round(float(x), 3) for x in out]


def envelope(t_src, v_src, grid):
    """Per-bin min/max/mean, so high-frequency oscillation is shown rather than aliased."""
    if len(t_src) == 0:
        empty = [None] * len(grid)
        return empty, empty, empty
    edges = np.concatenate([grid, [grid[-1] + (grid[1] - grid[0] if len(grid) > 1 else 1.0)]])
    bins = np.searchsorted(edges, t_src, side="right") - 1
    lo = np.full(len(grid), np.nan); hi = np.full(len(grid), np.nan); mu = np.full(len(grid), np.nan)
    order = np.argsort(bins, kind="stable")
    bs, vs = bins[order], v_src[order]
    start = 0
    while start < len(bs):
        b = bs[start]
        end = start
        while end + 1 < len(bs) and bs[end + 1] == b:
            end += 1
        if 0 <= b < len(grid):
            seg = vs[start:end + 1]
            seg = seg[np.isfinite(seg)]
            if len(seg):
                lo[b] = seg.min(); hi[b] = seg.max(); mu[b] = seg.mean()
        start = end + 1
    r = lambda a: [None if not np.isfinite(x) else round(float(x), 2) for x in a]
    return r(lo), r(hi), r(mu)


def break_wraps(series):
    """Insert None where a 0/360 wrap would otherwise draw a vertical streak."""
    out = list(series)
    for i in range(1, len(out)):
        a, b = out[i - 1], out[i]
        if a is not None and b is not None and abs(b - a) > 180:
            out[i - 1] = None
    return out


def build_log(path):
    d = load_csv(path)
    if len(d["imu_t"]) < 100 or len(d["p_t"]) < 100:
        return None
    t0 = min(d["imu_t"][0], d["p_t"][0], d["g_t"][0] if len(d["g_t"]) else d["imu_t"][0])
    t_end = max(d["imu_t"][-1], d["p_t"][-1])
    dur = t_end - t0
    if dur < 60:
        return None
    n = min(TARGET_POINTS, max(200, int(dur)))
    grid = np.linspace(0.0, dur, n)

    heading, pitch, roll = heading_pitch_roll(d["quat"], d["grav"])
    gyro_deg = np.degrees(d["gyro"])
    it = d["imu_t"] - t0

    depth = decimate_nearest(d["p_t"] - t0, d["depth"], grid)
    pitch_s = decimate_nearest(it, pitch, grid)
    roll_s = decimate_nearest(it, roll, grid)
    hdg_s = break_wraps(decimate_nearest(it, heading, grid))

    rr_lo, rr_hi, rr_mu = envelope(it, gyro_deg[:, 0], grid)
    pr_lo, pr_hi, pr_mu = envelope(it, gyro_deg[:, 1], grid)
    yr_lo, yr_hi, yr_mu = envelope(it, gyro_deg[:, 2], grid)

    fix = d["mode"] >= 3 if len(d["mode"]) else np.array([], dtype=bool)
    gt = (d["g_t"] - t0)[fix] if len(d["g_t"]) else np.array([])
    sog_s = decimate_nearest(gt, d["sog"][fix], grid) if len(gt) else [None] * n
    cog_s = break_wraps(decimate_nearest(gt, d["cog"][fix], grid)) if len(gt) else [None] * n
    rpm_s = decimate_nearest(d["m_t"] - t0, d["rpm"], grid) if len(d["m_t"]) else [None] * n

    # Local tangent-plane track, metres from the median position.
    east = north = [None] * n
    if len(gt) > 10:
        lat0 = float(np.median(d["lat"][fix])); lon0 = float(np.median(d["lon"][fix]))
        e = np.radians(d["lon"][fix] - lon0) * R_EARTH * math.cos(math.radians(lat0))
        nn = np.radians(d["lat"][fix] - lat0) * R_EARTH
        east = decimate_nearest(gt, e, grid)
        north = decimate_nearest(gt, nn, grid)

    dep_arr = np.array([np.nan if x is None else x for x in depth])
    sub = [None if not np.isfinite(x) else int(x > 1.0) for x in dep_arr]

    m = re.match(r"(bot\d+)_(fleet\d+)_(\d{8})T", os.path.basename(path))
    bot, fleet, date = m.groups() if m else ("?", "?", "?")
    dist = 0.0
    if len(gt) > 10:
        ee = np.array([np.nan if x is None else x for x in east])
        nnn = np.array([np.nan if x is None else x for x in north])
        step = np.hypot(np.diff(ee), np.diff(nnn))
        dist = float(np.nansum(step[step < 50]))

    finite_depth = dep_arr[np.isfinite(dep_arr)]
    return dict(
        name=os.path.basename(path)[:-4], bot=bot, fleet=fleet,
        date=f"{date[:4]}-{date[4:6]}-{date[6:]}" if len(date) == 8 else date,
        durationS=round(dur), maxDepth=round(float(finite_depth.max()), 1) if len(finite_depth) else 0,
        pctSubmerged=round(100.0 * float(np.mean([s for s in sub if s is not None]) if any(s is not None for s in sub) else 0), 1),
        distanceM=round(dist), hasMag=d["has_mag"], hasMotor=bool(len(d["m_t"])),
        t=[round(float(x), 1) for x in grid],
        depth=depth, pitch=pitch_s, roll=roll_s, heading=hdg_s, cog=cog_s,
        sog=sog_s, rpm=rpm_s, east=east, north=north, submerged=sub,
        rollRate=dict(lo=rr_lo, hi=rr_hi, mu=rr_mu),
        pitchRate=dict(lo=pr_lo, hi=pr_hi, mu=pr_mu),
        yawRate=dict(lo=yr_lo, hi=yr_hi, mu=yr_mu),
    )


def main():
    out_path = os.path.expanduser("~/Projects/jaia-work/jaia_log_viz.html")
    wanted = sys.argv[1:] if len(sys.argv) > 1 else [
        "bot2_fleet61_20260414T185410", "bot1_fleet55_20251223T153211",
        "bot21_fleet50_20250904T160858", "bot1_fleet3_20250213T202111",
        "bot5_fleet52_20251027T134925", "bot2_fleet4_20250605T184447",
    ]
    paths = []
    for d in ("csv", "csv2"):
        paths += glob.glob(os.path.expanduser(f"~/Projects/jaia-work/{d}/*.csv"))
    paths = [p for p in paths if ".truth." not in p]
    chosen = [p for w in wanted for p in paths if os.path.basename(p)[:-4] == w]

    logs = []
    for p in chosen:
        print("building", os.path.basename(p), flush=True)
        b = build_log(p)
        if b:
            logs.append(b)
    if not logs:
        print("no logs built"); return

    here = os.path.dirname(os.path.abspath(__file__))
    tmpl = open(os.path.join(here, "viz_template.html")).read()
    ev_path = os.path.join(here, "evidence.json")
    evidence = json.load(open(ev_path)) if os.path.exists(ev_path) else {"params": {}, "n_logs": 0}
    html = tmpl.replace("__DATA__", json.dumps(logs, separators=(",", ":"), allow_nan=False,
                                               default=lambda o: None))
    html = html.replace("__EVIDENCE__", json.dumps(evidence, separators=(",", ":"),
                                                   allow_nan=False, default=lambda o: None))
    with open(out_path, "w") as f:
        f.write(html)
    print(f"\nwrote {out_path}  ({os.path.getsize(out_path)/1e6:.1f} MB, {len(logs)} logs)")


if __name__ == "__main__":
    main()
