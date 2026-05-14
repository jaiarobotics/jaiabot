#!/usr/bin/env python3
"""
Calibrate per-state power draw and per-dive energy from JaiaBot HDF5 logs.

For each mission state of interest (HOLD, transit, task surface drift, etc.)
this script:
  1. Identifies contiguous windows of that state in the bot_status log
  2. Integrates instantaneous battery power (V × I from arduino_to_pi) over each
     window using the trapezoidal rule
  3. Reports the median per-window mean power in watts

For dives, it integrates power across the full DIVE_PREP → REACQUIRE_GPS cycle
to get a typical "energy per dive" constant, then regresses that energy against
max dive depth to estimate a depth-dependent dive energy curve.

Output is written as JSON. This file is loaded by extract_features.py at
training/inference time so plan-derived features can be converted to physically
calibrated energy in Wh.

Usage:
    python3 calibrate.py --logs-dir <dir> --output calibration.json
"""

import argparse
import glob
import json
import os
from collections import defaultdict

import h5py
import numpy as np

# Mission state enums from src/lib/messages/mission.proto
STATE_TRANSIT             = 110
STATE_TASK_STATION_KEEP   = 120
STATE_TASK_SURFACE_DRIFT  = 121
STATE_DIVE_PREP           = 123
STATE_POWERED_DESCENT     = 124
STATE_HOLD                = 125
STATE_UNPOWERED_ASCENT    = 126
STATE_POWERED_ASCENT      = 127
STATE_REACQUIRE_GPS       = 128
STATE_DIVE_SURFACE_DRIFT  = 129
STATE_RECOVERY_STATION_KEEP = 141

# States to report per-state mean power for. Names match the calibration.json
# keys consumed by extract_features.py.
PER_STATE_TARGETS = {
    "transit":              STATE_TRANSIT,
    "task_surface_drift":   STATE_TASK_SURFACE_DRIFT,
    "task_station_keep":    STATE_TASK_STATION_KEEP,
    "dive_hold":            STATE_HOLD,
    "post_dive_drift":      STATE_DIVE_SURFACE_DRIFT,
    "recovery_station_keep": STATE_RECOVERY_STATION_KEEP,
}

# Contiguous run of these substates is treated as a single "dive event" for
# per-dive energy integration.
DIVE_STATES = {
    STATE_DIVE_PREP, STATE_POWERED_DESCENT, STATE_HOLD,
    STATE_UNPOWERED_ASCENT, STATE_POWERED_ASCENT, STATE_REACQUIRE_GPS,
}

# Drop windows shorter than this (likely state-machine glitches, not real)
MIN_WINDOW_S = 5.0


def find_runs(state: np.ndarray, target: set[int]) -> list[tuple[int, int]]:
    """Return [(start, end_exclusive), ...] for contiguous runs of state in target."""
    in_run = np.isin(state, list(target))
    runs = []
    i, n = 0, len(in_run)
    while i < n:
        if in_run[i]:
            j = i
            while j < n and in_run[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    return runs


def integrate_window(ad_t: np.ndarray, ad_p: np.ndarray,
                     t0: int, t1: int) -> tuple[float, float] | None:
    """Trapezoidal-integrate power over [t0, t1] (microseconds).
    Returns (energy_wh, mean_w) or None if not enough samples."""
    dur_s = (t1 - t0) / 1e6
    if dur_s < MIN_WINDOW_S:
        return None
    mask = (ad_t >= t0) & (ad_t <= t1)
    if mask.sum() < 2:
        return None
    t = ad_t[mask] / 1e6
    p = ad_p[mask]
    energy_wh = float(np.trapz(p, t) / 3600)
    mean_w = energy_wh * 3600 / dur_s
    return energy_wh, mean_w


def process_log(h5_path: str,
                state_power_samples: dict[str, list[float]],
                dive_records: list[tuple[float, float, float | None]]):
    """Accumulate per-state mean-power samples and per-dive (energy, duration, depth)."""
    f = h5py.File(h5_path, "r")
    try:
        status_keys = [k for k in f.keys() if k.startswith("jaiabot::bot_status")]
        if not status_keys:
            return
        status_keys.sort(
            key=lambda k: f[f"{k}/jaiabot.protobuf.BotStatus/_utime_"].shape[0],
            reverse=True,
        )
        base = f"{status_keys[0]}/jaiabot.protobuf.BotStatus"
        bs_t = f[f"{base}/_utime_"][:]
        bs_state = f[f"{base}/mission_state"][:].astype(int)
        try:
            bs_depth = f[f"{base}/depth"][:]
        except KeyError:
            bs_depth = None

        ad_key = "jaiabot::arduino_to_pi/jaiabot.protobuf.ArduinoResponse"
        if ad_key not in f:
            return
        ad_t = f[f"{ad_key}/_utime_"][:]
        ad_v = f[f"{ad_key}/vccvoltage"][:]
        ad_i = f[f"{ad_key}/vcccurrent"][:]
    finally:
        f.close()

    valid = (ad_v > 0) & (ad_i > 0)
    ad_t, ad_p = ad_t[valid], (ad_v[valid] * ad_i[valid])

    # Per-state mean power, one sample per window
    for name, state_id in PER_STATE_TARGETS.items():
        for i0, i1 in find_runs(bs_state, {state_id}):
            t0, t1 = int(bs_t[i0]), int(bs_t[i1 - 1])
            res = integrate_window(ad_t, ad_p, t0, t1)
            if res is not None:
                state_power_samples[name].append(res[1])

    # Per-dive cycle energy
    for i0, i1 in find_runs(bs_state, DIVE_STATES):
        substates = set(int(x) for x in bs_state[i0:i1])
        # require an actual descent/ascent — skip stray HOLD-only blips
        if not (substates & {STATE_POWERED_DESCENT, STATE_UNPOWERED_ASCENT, STATE_POWERED_ASCENT}):
            continue
        t0, t1 = int(bs_t[i0]), int(bs_t[i1 - 1])
        res = integrate_window(ad_t, ad_p, t0, t1)
        if res is None:
            continue
        energy_wh, _ = res
        dur_s = (t1 - t0) / 1e6
        max_depth = float(bs_depth[i0:i1].max()) if bs_depth is not None else None
        dive_records.append((energy_wh, dur_s, max_depth))


def fit_dive_energy_curve(dive_records: list[tuple[float, float, float | None]]) -> dict:
    """Fit a simple line: dive_energy_wh = a + b * depth_m.
    Falls back to median energy if depth data is sparse or degenerate."""
    typed = [(e, d) for e, _dur, d in dive_records if d is not None and d > 0]
    if len(typed) < 5:
        median_e = float(np.median([e for e, _, _ in dive_records])) if dive_records else 0.0
        return {"fit": "flat", "intercept_wh": median_e, "per_meter_wh": 0.0,
                "n_samples": len(dive_records)}
    Es = np.array([e for e, _ in typed])
    Ds = np.array([d for _, d in typed])
    if Ds.std() < 0.5:
        median_e = float(np.median(Es))
        return {"fit": "flat", "intercept_wh": median_e, "per_meter_wh": 0.0,
                "n_samples": len(typed)}
    # Non-negative least squares: enforce E = a + b*D with a, b >= 0
    from scipy.optimize import nnls
    A = np.column_stack([np.ones_like(Ds), Ds])
    coef, _ = nnls(A, Es)
    return {"fit": "linear", "intercept_wh": float(coef[0]),
            "per_meter_wh": float(coef[1]), "n_samples": len(typed)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs-dir", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.logs_dir, "*.h5")))
    if not files:
        print(f"No .h5 files in {args.logs_dir}")
        return

    state_power_samples: dict[str, list[float]] = defaultdict(list)
    dive_records: list[tuple[float, float, float | None]] = []

    for p in files:
        print(f"Calibrating {os.path.basename(p)} ...")
        try:
            process_log(p, state_power_samples, dive_records)
        except Exception as e:
            print(f"  SKIP {os.path.basename(p)}: {e}")

    out: dict = {"loads_w": {}, "dive_energy": {}, "dataset_source": os.path.abspath(args.logs_dir)}
    print(f"\n{'State':<24}{'n_windows':>12}{'median_W':>10}{'mean_W':>10}{'p25_W':>10}{'p75_W':>10}")
    for name in PER_STATE_TARGETS:
        vals = np.array(state_power_samples[name])
        if len(vals) == 0:
            out["loads_w"][name] = None
            print(f"{name:<24}{'(no data)':>12}")
            continue
        out["loads_w"][name] = {
            "median_w":  float(np.median(vals)),
            "mean_w":    float(vals.mean()),
            "p25_w":     float(np.percentile(vals, 25)),
            "p75_w":     float(np.percentile(vals, 75)),
            "n_windows": int(len(vals)),
        }
        print(f"{name:<24}{len(vals):>12}{np.median(vals):>10.1f}{vals.mean():>10.1f}"
              f"{np.percentile(vals,25):>10.1f}{np.percentile(vals,75):>10.1f}")

    out["dive_energy"] = fit_dive_energy_curve(dive_records)
    print(f"\nDive energy fit ({len(dive_records)} dive cycles):")
    print(f"  intercept_wh = {out['dive_energy']['intercept_wh']:.3f}")
    print(f"  per_meter_wh = {out['dive_energy']['per_meter_wh']:.4f}")

    with open(args.output, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote calibration to {args.output}")


if __name__ == "__main__":
    main()
