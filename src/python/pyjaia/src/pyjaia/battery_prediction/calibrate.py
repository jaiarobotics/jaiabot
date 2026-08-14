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

from jaiabot.messages.mission_pb2 import (
    IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT as STATE_TRANSIT,
    IN_MISSION__UNDERWAY__TASK__STATION_KEEP as STATE_TASK_STATION_KEEP,
    IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT as STATE_TASK_SURFACE_DRIFT,
    IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP as STATE_DIVE_PREP,
    IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT as STATE_POWERED_DESCENT,
    IN_MISSION__UNDERWAY__TASK__DIVE__HOLD as STATE_HOLD,
    IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT as STATE_UNPOWERED_ASCENT,
    IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT as STATE_POWERED_ASCENT,
    IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS as STATE_REACQUIRE_GPS,
    IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT as STATE_DIVE_SURFACE_DRIFT,
    IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP as STATE_RECOVERY_STATION_KEEP,
)

GPS_JUMP_THRESHOLD_M = 100  # discard teleport jumps when computing distance

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

# Contiguous run of any of these substates is one "dive event". HOLD is
# deliberately excluded from the dive-energy integration: the hold portion is
# accounted for separately via hotel_energy_wh = dive_hold_w * dive_hold_s, so
# including it here would double-count.
DIVE_CYCLE_STATES = {
    STATE_DIVE_PREP, STATE_POWERED_DESCENT,
    STATE_UNPOWERED_ASCENT, STATE_POWERED_ASCENT, STATE_REACQUIRE_GPS,
}
# Used to identify a dive cycle even when its HOLD samples land in between
# descent/ascent in the time series; we still want to skip those samples.
DIVE_STATES = DIVE_CYCLE_STATES | {STATE_HOLD}

# Drop windows shorter than this (likely state-machine glitches, not real)
MIN_WINDOW_S = 5.0

# Nominal pack capacity for the standard Hydro battery, used downstream when
# converting Wh-of-drain back into percentage points for sanity checks. The
# model itself learns the Wh→% mapping from data, so this constant is for
# diagnostics and feasibility analysis, not for inference.
BATTERY_CAPACITY_WH = 132.0


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
                dive_records: list[tuple[float, float, float | None]],
                transit_records: list[tuple[float, float]]):
    """Accumulate per-state mean power, per-dive (energy, dur, depth), and
    per-transit-window (planned_speed_m_s, mean_power_w).

    Transit speed is taken from the most recent MISSION_PLAN hub command's
    `plan/speeds/transit`, not GPS, because the motor draw is driven by the
    commanded speed regardless of what the bot actually achieves through
    currents and sea state."""
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

        # Hub command planned-speed timeline for matching transit windows
        plan_utime = np.array([], dtype=np.int64)
        plan_speed = np.array([], dtype=float)
        if "jaiabot::hub_command" in f:
            hc_base = "jaiabot::hub_command/jaiabot.protobuf.Command"
            try:
                hc_utime    = f[f"{hc_base}/_utime_"][:]
                hc_speeds   = f[f"{hc_base}/plan/speeds/transit"][:]
                hc_cmd_type = f[f"{hc_base}/type"][:]
                # type=1 is MISSION_PLAN; require a finite, positive speed
                mask = (hc_cmd_type == 1) & ~np.isnan(hc_speeds) & (hc_speeds > 0)
                plan_utime = hc_utime[mask].astype(np.int64)
                plan_speed = hc_speeds[mask].astype(float)
            except KeyError:
                pass

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

    # Per-transit (planned_speed, power) pairs
    if plan_utime.size > 0:
        for i0, i1 in find_runs(bs_state, {STATE_TRANSIT}):
            t0, t1 = int(bs_t[i0]), int(bs_t[i1 - 1])
            dur_s = (t1 - t0) / 1e6
            if dur_s < 20.0:
                continue
            idx = int(np.searchsorted(plan_utime, t0, side="right") - 1)
            if idx < 0:
                continue
            planned_v = float(plan_speed[idx])
            res = integrate_window(ad_t, ad_p, t0, t1)
            if res is None:
                continue
            transit_records.append((planned_v, res[1]))

    # Per-dive cycle energy, excluding HOLD time. Within each dive run we
    # integrate only across arduino samples whose corresponding bot_status
    # mission_state is in DIVE_CYCLE_STATES (i.e. not HOLD). The HOLD portion
    # is captured separately by hotel_energy_wh in the inference pipeline.
    for i0, i1 in find_runs(bs_state, DIVE_STATES):
        substates = set(int(x) for x in bs_state[i0:i1])
        if not (substates & {STATE_POWERED_DESCENT, STATE_UNPOWERED_ASCENT, STATE_POWERED_ASCENT}):
            continue
        t0, t1 = int(bs_t[i0]), int(bs_t[i1 - 1])
        # Map each arduino sample to its bot_status mission_state at that time
        mask_window = (ad_t >= t0) & (ad_t <= t1)
        if mask_window.sum() < 2:
            continue
        ad_t_in = ad_t[mask_window]
        ad_p_in = ad_p[mask_window]
        bs_idx_for_ad = np.searchsorted(bs_t, ad_t_in, side="right") - 1
        bs_idx_for_ad = np.clip(bs_idx_for_ad, 0, len(bs_state) - 1)
        ad_state = bs_state[bs_idx_for_ad]
        keep = np.isin(ad_state, list(DIVE_CYCLE_STATES))
        if keep.sum() < 2:
            continue
        # Integrate energy only over non-HOLD samples; effective duration is the
        # span between first and last kept sample so per-dive energy stays
        # representative of "descent+ascent+reacquire" time.
        t_kept = ad_t_in[keep] / 1e6
        p_kept = ad_p_in[keep]
        energy_wh = float(np.trapz(p_kept, t_kept) / 3600)
        dur_s = float(t_kept[-1] - t_kept[0])
        if dur_s < MIN_WINDOW_S:
            continue
        max_depth = float(bs_depth[i0:i1].max()) if bs_depth is not None else None
        dive_records.append((energy_wh, dur_s, max_depth))


def fit_transit_power_curve(records: list[tuple[float, float]]) -> dict:
    """Build a planned-speed -> motor watts curve from transit-window samples.

    For each distinct planned transit speed appearing in the logs, report the
    median measured battery power over the window. Returns arrays ready for
    numpy.interp at inference time. Falls back to the hardware-spec curve
    when too few samples are available.
    """
    HARDWARE_FALLBACK = {
        "speeds_m_s": [2.0, 2.2, 3.0],
        "watts":      [71.0, 75.0, 181.0],
        "source":     "hardware_spec_fallback",
        "n_samples":  0,
    }
    if len(records) < 20:
        return HARDWARE_FALLBACK

    speeds = np.array([r[0] for r in records])
    powers = np.array([r[1] for r in records])
    # Plan speeds in the dataset are quantized (1.0, 2.0, 2.5, 3.0 ...) so we
    # group exactly rather than bucketing across a continuous range.
    rounded = np.round(speeds, 2)
    bins: dict[float, list[float]] = {}
    for v, w in zip(rounded, powers):
        bins.setdefault(float(v), []).append(float(w))

    pairs = []
    for v in sorted(bins):
        ws = bins[v]
        if len(ws) < 3:
            continue
        pairs.append((v, float(np.median(ws)), len(ws)))

    if len(pairs) < 2:
        return HARDWARE_FALLBACK

    out_speeds = [p[0] for p in pairs]
    out_watts  = [p[1] for p in pairs]
    # Motor power should rise (or hold) with speed; enforce monotone non-decreasing
    out_watts = list(np.maximum.accumulate(out_watts))
    return {
        "speeds_m_s":   out_speeds,
        "watts":        out_watts,
        "per_bin_n":    [p[2] for p in pairs],
        "source":       "data",
        "n_samples":    len(records),
    }


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
    transit_records: list[tuple[float, float]] = []

    for p in files:
        print(f"Calibrating {os.path.basename(p)} ...")
        try:
            process_log(p, state_power_samples, dive_records, transit_records)
        except Exception as e:
            print(f"  SKIP {os.path.basename(p)}: {e}")

    out: dict = {
        "battery_capacity_wh": BATTERY_CAPACITY_WH,
        "loads_w": {},
        "transit_power_curve": {},
        "dive_energy": {},
        "dataset_source": os.path.abspath(args.logs_dir),
    }
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

    out["transit_power_curve"] = fit_transit_power_curve(transit_records)
    print(f"\nTransit power curve ({out['transit_power_curve']['source']}, "
          f"{out['transit_power_curve']['n_samples']} windows):")
    for v, w in zip(out["transit_power_curve"].get("speeds_m_s", []),
                    out["transit_power_curve"].get("watts", [])):
        print(f"  {v:.2f} m/s -> {w:.1f} W")

    out["dive_energy"] = fit_dive_energy_curve(dive_records)
    print(f"\nDive energy fit ({len(dive_records)} dive cycles):")
    print(f"  intercept_wh = {out['dive_energy']['intercept_wh']:.3f}")
    print(f"  per_meter_wh = {out['dive_energy']['per_meter_wh']:.4f}")

    with open(args.output, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote calibration to {args.output}")


if __name__ == "__main__":
    main()
