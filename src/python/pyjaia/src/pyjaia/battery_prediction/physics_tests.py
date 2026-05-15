#!/usr/bin/env python3
"""
Physics adherence test suite for the battery drain prediction model.

For each test case, take a baseline mission and vary one feature, then
check that the model's predicted change in drain falls within a physically
plausible range derived from `battery_capacity_wh` in calibration.json.

Usage:
    python3 physics_tests.py
    python3 physics_tests.py --model /path/to/battery_model.pkl
    python3 physics_tests.py --calibration /path/to/calibration.json

A test "passes" if the model's predicted Δdrain lies in the expected range.
Ranges are loose ([~0.7×, ~2.0×] of straight-physics expectation) to allow
for non-linearities and per-bot factors the model legitimately captures.
"""

import argparse
import json
import os
import pickle
import sys

import numpy as np

_HERE = os.path.dirname(__file__)
DEFAULT_MODEL_PATH = os.path.join(_HERE, "battery_model.pkl")
DEFAULT_CALIBRATION_PATH = os.path.join(_HERE, "calibration.json")

# Baseline mission used by every test. Synthetic — not loaded from a log file
# — but each value below is sourced from a real row of dataset.csv so that the
# tests probe the model in a regime it was actually trained on.
#
# Origin: the cluster of 15 "fleet52" missions in the training set (16-dive,
# 3.0 m/s planned transit, 9 m mean depth, 120 s total hold). Specifically:
#
#   bot_type                =  1     (HYDRO; all fleet52 logs have type=1)
#   transit_energy_wh       =  8.13  (mean across the 15 fleet52 rows; range 8.05-8.13)
#   transit_time_s          =  195.0 (rounded; per-row range 175-197)
#   turn_density_deg_per_km =  1297.7 (identical across all 15 rows -- same route geometry)
#   dive_energy_wh          =  14.38 (identical across all 15 rows: 16 dives x (0.71 + 0.025x9))
#   starting_battery_pct    =  90.0  (rough midpoint; per-row range 74.7-94.7)
#   hotel_energy_wh         =  0.0   (deliberately set to 0 so hold/drift/SK tests can perturb
#                                     it upward from a clean zero; real-row values are 0 or 2.09)
BASELINE = {
    "bot_type":                  1,
    "transit_energy_wh":         8.13,
    "transit_time_s":            195.0,
    "turn_density_deg_per_km":   1297.7,
    "hotel_energy_wh":           0.0,
    "dive_energy_wh":            14.38,
    "starting_battery_pct":      90.0,
}


def load_model(path: str):
    with open(path, "rb") as f:
        bundle = pickle.load(f)
    return bundle["model"], bundle["features"]


def load_calibration(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def predict(model, features: list[str], **kwargs) -> float:
    row = dict(BASELINE)
    row.update(kwargs)
    x = np.array([[row[f] for f in features]], dtype=float)
    return float(model.predict(x)[0])


def make_tests(cap_wh: float, dive_hold_w: float,
               surface_drift_w: float, station_keep_w: float) -> list[tuple]:
    """Build (name, feature, lo_val, hi_val, expected_lo_pct, expected_hi_pct).

    Physics conversion: 1 Wh on a `cap_wh` battery = (1 / cap_wh × 100) % drain.
    Each Wh-based test expects roughly that × [0.7, 2.0] for slack.
    """
    def wh_pct(wh): return wh / cap_wh * 100

    hold_wh = dive_hold_w * 120 / 3600              # 120s of HOLD
    drift_wh = surface_drift_w * 3600 / 3600        # 1 hr of drift
    sk_wh    = station_keep_w * 3600 / 3600         # 1 hr of station-keep

    return [
        # (name, feature, lo, hi, expected_lo_%, expected_hi_%)
        ("Hold 0->120s",        "hotel_energy_wh",         0.0,    hold_wh,
            wh_pct(hold_wh) * 0.7, wh_pct(hold_wh) * 2.0),
        ("Transit +5 Wh",       "transit_energy_wh",       8.13,   13.13,
            wh_pct(5.0) * 0.7,     wh_pct(5.0) * 2.0),
        ("Dive energy +5 Wh",   "dive_energy_wh",         14.38,  19.38,
            wh_pct(5.0) * 0.7,     wh_pct(5.0) * 2.0),
        ("Drift 1hr",           "hotel_energy_wh",         0.0,    drift_wh,
            wh_pct(drift_wh) * 0.5, wh_pct(drift_wh) * 2.0),
        ("Station-keep 1hr",    "hotel_energy_wh",         0.0,    sk_wh,
            wh_pct(sk_wh) * 0.7,   wh_pct(sk_wh) * 2.0),
        ("Turn density 2x",     "turn_density_deg_per_km", 1297.7, 2595.4,
            0.0, 5.0),
        ("Start batt 50->100",  "starting_battery_pct",   50.0,   100.0,
            -0.5, 3.0),
        ("Transit time +60s",   "transit_time_s",        195.0,   255.0,
            -0.5, 2.0),
        ("Bot type 1->2",       "bot_type",               1,      2,
            -3.0, 5.0),
    ]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", default=DEFAULT_MODEL_PATH,
                    help="Path to battery_model.pkl (default: bundled with package)")
    ap.add_argument("--calibration", default=DEFAULT_CALIBRATION_PATH,
                    help="Path to calibration.json (default: bundled with package)")
    args = ap.parse_args()

    model, features = load_model(args.model)
    cal = load_calibration(args.calibration)

    cap = float(cal.get("battery_capacity_wh", 132.0))
    dive_hold_w     = float(cal["loads_w"]["dive_hold"]["median_w"])
    surface_drift_w = float(cal["loads_w"]["post_dive_drift"]["median_w"])
    sk_entry = cal["loads_w"].get("task_station_keep") \
        or cal["loads_w"]["recovery_station_keep"]
    station_keep_w  = float(sk_entry["median_w"])

    tests = make_tests(cap, dive_hold_w, surface_drift_w, station_keep_w)

    print(f"Model:        {args.model}")
    print(f"Features:     {features}")
    print(f"Battery cap:  {cap} Wh")
    print(f"Wattages:     hold={dive_hold_w:.1f}W  drift={surface_drift_w:.2f}W  "
          f"sk={station_keep_w:.1f}W")
    print()
    print(f"{'Test':<24}{'Expected':>20}{'Predicted Δ':>14}{'Result':>10}")
    print("-" * 68)

    passes = 0
    for name, feat, lo, hi, e_lo, e_hi in tests:
        delta = predict(model, features, **{feat: hi}) \
              - predict(model, features, **{feat: lo})
        ok = e_lo <= delta <= e_hi
        passes += int(ok)
        print(f"{name:<24}"
              f"{f'[{e_lo:+.2f}, {e_hi:+.2f}]%':>20}"
              f"{delta:>+13.2f}%"
              f"{'✓' if ok else '✗':>10}")

    print("-" * 68)
    print(f"\nResult: {passes}/{len(tests)} tests passed")
    return 0 if passes == len(tests) else 1


if __name__ == "__main__":
    sys.exit(main())
