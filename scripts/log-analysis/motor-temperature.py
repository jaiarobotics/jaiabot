#!/usr/bin/env python3
"""Analyze one run of the motor temperature characterization test.

Usage:
    motor-temperature.py [--pause SECONDS] [--csv OUT_DIR] LOG.h5 [LOG.h5 ...]

Pass the bot's logs for one run, converted to HDF5 (as offloaded to the hub, or with
goby_log_tool --format HDF5). Prints the values the test plan's analysis table asks for.
Temperatures are in celsius, and are also given as degrees above the water temperature.
"""

import argparse
import csv
import math
import os
import sys

import h5py
import numpy as np

CHECK_MOTOR_TEMPERATURE = 164
DIVE_PREP = 123
AFTER_DIVE_MOTOR_OFF = {126, 128, 129}  # unpowered ascent, reacquire GPS, surface drift
SURFACE_DRIFT_STATES = {121, 129}
STOPPED = 142  # the operator's Stop at the end of a run

PROTOBUF_SCHEME = 1
READING_WINDOW = 5  # seconds, as the bot averages
DRIVING_THROTTLE = 1  # percent
# ESC power cutback: the overheated ESC cuts motor power, so RPM drops at the same throttle.
# RPM this far below the fit of RPM against throttle and battery voltage counts as cutback.
CUTBACK_DROP = 0.10
CUTBACK_HOLD = 60  # seconds the drop must last


def load(files, group, msg_type, fields):
    """Concatenates fields of one logged group across files, sorted by time (seconds)."""
    columns = {"t": []}
    columns.update({f: [] for f in fields})
    for h5 in files:
        # intervehicle groups carry their group number, e.g. jaiabot::bot_status;30
        names = [k for k in h5.keys() if k == group or k.startswith(group + ";")]
        if not names or msg_type not in h5[names[0]]:
            continue
        g = h5[names[0]][msg_type]
        keep = np.ones(len(g["_utime_"]), dtype=bool)
        if "_scheme_" in g and PROTOBUF_SCHEME in np.unique(g["_scheme_"]):
            keep = np.array(g["_scheme_"]) == PROTOBUF_SCHEME
        columns["t"].append(np.array(g["_utime_"])[keep] / 1e6)
        for f in fields:
            values = np.array(g[f])[keep] if f in g else np.full(keep.sum(), np.nan)
            columns[f].append(values.astype(float))
    if not columns["t"]:
        return None
    order = np.argsort(np.concatenate(columns["t"]))
    return {k: np.concatenate(v)[order] for k, v in columns.items()}


def intervals(states, wanted):
    """[(start, end)] of the stretches where the mission state is in wanted."""
    result, start = [], None
    for t, s in zip(states["t"], states["state"]):
        if s in wanted and start is None:
            start = t
        elif s not in wanted and start is not None:
            result.append((start, t))
            start = None
    if start is not None:
        result.append((start, states["t"][-1]))
    return result


def mean_between(series, field, t0, t1):
    if series is None:
        return None
    mask = (series["t"] >= t0) & (series["t"] <= t1) & np.isfinite(series[field])
    return float(np.mean(series[field][mask])) if mask.any() else None


def value_at(series, field, t):
    if series is None or not len(series["t"]):
        return None
    mask = np.isfinite(series[field])
    if not mask.any():
        return None
    return float(np.interp(t, series["t"][mask], series[field][mask]))


def driving_seconds(throttle, t0, t1):
    if throttle is None:
        return t1 - t0
    mask = (throttle["t"] >= t0) & (throttle["t"] <= t1)
    t = throttle["t"][mask]
    if len(t) < 2:
        return 0.0
    dt = np.minimum(np.diff(t), 5)
    return float(np.sum(dt[np.abs(throttle["motor"][mask][:-1]) > DRIVING_THROTTLE]))


def distance_m(lat0, lon0, lat1, lon1):
    x = math.radians(lon1 - lon0) * math.cos(math.radians((lat0 + lat1) / 2))
    y = math.radians(lat1 - lat0)
    return 6371000 * math.hypot(x, y)


def fmt(value, unit="", water=None, decimals=1):
    if value is None:
        return "n/a"
    text = f"{value:.{decimals}f}{unit}"
    if water is not None:
        text += f" ({value - water:+.{decimals}f} above water)"
    return text


def analyze_checks(motor, states, throttle, pause):
    windows = intervals(states, {CHECK_MOTOR_TEMPERATURE})
    if not windows:
        return [], pause
    if pause is None:
        pause = min(t1 - t0 for t0, t1 in windows)
    checks = []
    previous_end = None
    for t0, t1 in windows:
        settled = t0 + pause
        reading = mean_between(motor, "temperature", settled - READING_WINDOW, settled)
        if reading is None:
            continue
        hold = t1 - settled > 3
        end = mean_between(motor, "temperature", t1 - READING_WINDOW, t1) if hold else reading

        first = mean_between(motor, "temperature", t0 + 1, t0 + 3)
        peak, peak_after = first, 0.0
        for s in range(3, int(min(t1 - t0 - 1, 60))):
            v = mean_between(motor, "temperature", t0 + s - 1, t0 + s + 1)
            if v is not None and peak is not None and v > peak:
                peak, peak_after = v, float(s)

        driving = driving_seconds(throttle, previous_end, t0) if previous_end else None
        checks.append({
            "start": t0, "end": t1, "reading": reading, "hold": hold, "end_reading": end,
            "hold_minutes": (t1 - settled) / 60 if hold else 0.0,
            "soak_rise": (peak - first) if first is not None else None,
            "soak_seconds": peak_after,
            "driving_minutes_before": driving / 60 if driving is not None else None,
        })
        previous_end = t1
    return checks, pause


def heating_rates(checks):
    rates = []
    for before, after in zip(checks, checks[1:]):
        minutes = after["driving_minutes_before"]
        if minutes and minutes > 0.5:
            rates.append((after["start"], (after["reading"] - before["end_reading"]) / minutes))
    return rates


def esc_cutback(motor, throttle, arduino, checks):
    """When RPM falls below a fit of RPM against throttle and battery voltage."""
    if motor is None or throttle is None or arduino is None:
        return None
    rpm_mask = np.isfinite(motor["rpm"]) & (motor["rpm"] > 0)
    if not rpm_mask.any():
        return None
    t = motor["t"][rpm_mask]
    rpm = motor["rpm"][rpm_mask]
    pct = np.abs(np.interp(t, throttle["t"], throttle["motor"]))
    volts_mask = np.isfinite(arduino["vccvoltage"])
    volts = np.interp(t, arduino["t"][volts_mask], arduino["vccvoltage"][volts_mask])
    usable = pct > 10
    if usable.sum() < 10:
        return None
    t, rpm, pct, volts = t[usable], rpm[usable], pct[usable], volts[usable]

    cold = t <= t[0] + 300
    k = np.median(rpm[cold] / (pct[cold] * volts[cold]))
    ratio = rpm / (k * pct * volts)

    onset = None
    below_since = None
    for ti, r in zip(t, ratio):
        if r < 1 - CUTBACK_DROP:
            below_since = below_since if below_since is not None else ti
            if ti - below_since >= CUTBACK_HOLD:
                onset = below_since
                break
        else:
            below_since = None

    recoveries = []
    for c in checks:
        if not c["hold"]:
            continue
        before = ratio[(t >= c["start"] - 60) & (t < c["start"])]
        # skip the first seconds while the bot speeds back up
        after = ratio[(t > c["end"] + 10) & (t <= c["end"] + 70)]
        if len(before) and len(after):
            recoveries.append((c["start"], float(np.median(before)), float(np.median(after))))

    onset_temperature = None
    if onset is not None:
        earlier = [c for c in checks if c["start"] <= onset]
        later = [c for c in checks if c["start"] > onset]
        onset_temperature = (earlier[-1]["reading"] if earlier else None,
                             later[0]["reading"] if later else None)
    return {"onset": onset, "onset_temperature": onset_temperature, "recoveries": recoveries}


def drift_rates(bot_status, states):
    if bot_status is None:
        return []
    rates = []
    for t0, t1 in intervals(states, {CHECK_MOTOR_TEMPERATURE, STOPPED} | SURFACE_DRIFT_STATES):
        if t1 - t0 < 15:
            continue
        p0 = [value_at(bot_status, f, t0) for f in ("lat", "lon")]
        p1 = [value_at(bot_status, f, t1) for f in ("lat", "lon")]
        if None in p0 + p1:
            continue
        rates.append(distance_m(*p0, *p1) / ((t1 - t0) / 60))
    return rates


def dives(motor, states, bot_status, task_packets):
    results = []
    after_dive = intervals(states, AFTER_DIVE_MOTOR_OFF)
    for t0, t1 in intervals(states, {DIVE_PREP}):
        before = mean_between(motor, "temperature", t1 - READING_WINDOW, t1)
        later = [w for w in after_dive if w[0] > t1]
        after = mean_between(motor, "temperature", later[0][1] - READING_WINDOW,
                             later[0][1]) if later else None
        depth = None
        if task_packets is not None:
            packets = np.where(task_packets["t"] > t1)[0]
            if len(packets):
                depth = task_packets["depth_achieved"][packets[0]]
        results.append({
            "start": t1, "motor_before": before, "motor_after": after,
            "battery": value_at(bot_status, "battery_percent", t1),
            "depth_achieved": None if depth is None or np.isnan(depth) else float(depth),
        })
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("logs", nargs="+", help="HDF5 logs from one run of one bot")
    parser.add_argument("--pause", type=float,
                        help="pause_duration used in the run (default: shortest check)")
    parser.add_argument("--csv", help="also write checks.csv and dives.csv to this directory")
    args = parser.parse_args()

    files = [h5py.File(p, "r") for p in args.logs]
    motor = load(files, "jaiabot::motor_status", "jaiabot.protobuf.Motor",
                 ["thermistor/temperature", "rpm"])
    if motor is not None:
        motor["temperature"] = motor.pop("thermistor/temperature")
    states = load(files, "jaiabot::mission_report", "jaiabot.protobuf.MissionReport", ["state"])
    throttle = load(files, "jaiabot::low_control", "jaiabot.protobuf.LowControl",
                    ["control_surfaces/motor"])
    if throttle is not None:
        throttle["motor"] = throttle.pop("control_surfaces/motor")
        throttle = {k: v[np.isfinite(throttle["motor"])] for k, v in throttle.items()}
    arduino = load(files, "jaiabot::arduino_to_pi", "jaiabot.protobuf.ArduinoResponse",
                   ["vccvoltage"])
    water = load(files, "jaiabot::pressure_temperature",
                 "jaiabot.protobuf.PressureTemperatureData", ["temperature"])
    bot_status = load(files, "jaiabot::bot_status", "jaiabot.protobuf.BotStatus",
                      ["location/lat", "location/lon", "battery_percent"])
    if bot_status is not None:
        bot_status["lat"] = bot_status.pop("location/lat")
        bot_status["lon"] = bot_status.pop("location/lon")
    task_packets = load(files, "jaiabot::task_packet", "jaiabot.protobuf.TaskPacket",
                        ["dive/depth_achieved"])
    if task_packets is not None:
        task_packets["depth_achieved"] = task_packets.pop("dive/depth_achieved")
        task_packets = {k: v[np.isfinite(task_packets["depth_achieved"])]
                        for k, v in task_packets.items()}

    if motor is None or states is None:
        sys.exit("No motor_status or mission_report in these logs; are they the bot's logs?")

    water_c = None
    if water is not None and np.isfinite(water["temperature"]).any():
        water_c = float(np.nanmean(water["temperature"]))

    checks, pause = analyze_checks(motor, states, throttle, args.pause)
    rates = heating_rates(checks)
    start = states["t"][0]

    print(f"Logs: {', '.join(os.path.basename(p) for p in args.logs)}")
    print(f"Water temperature (3.2.1): {fmt(water_c, ' C')}")
    if throttle is not None:
        driving = np.abs(throttle["motor"]) > DRIVING_THROTTLE
        if driving.any():
            print(f"Median throttle while driving: {np.median(np.abs(throttle['motor'][driving])):.0f} %")

    print(f"\nMotor temperature checks ({len(checks)}, pause {fmt(pause, ' s', decimals=0)}):")
    for c in checks:
        line = f"  {(c['start'] - start) / 60:6.1f} min  {fmt(c['reading'], ' C', water_c)}"
        if c["hold"]:
            line += f"  held {c['hold_minutes']:.1f} min to {fmt(c['end_reading'], ' C')}"
        print(line)

    print("\nHeating (3.2.2 / 3.2.3):")
    for t, rate in rates:
        print(f"  {(t - start) / 60:6.1f} min  {rate:+.2f} C/min of driving")
    if len(rates) >= 3:
        last = [r for _, r in rates[-3:]]
        if max(abs(r) for r in last) < 0.2:
            print(f"  Levels off at about {fmt(checks[-1]['reading'], ' C', water_c)}")
        else:
            print(f"  Still rising at the end: {last[-1]:+.2f} C/min")

    print("\nESC power cutback (3.2.4):")
    d = esc_cutback(motor, throttle, arduino, checks)
    if d is None:
        print("  No RPM data (or too little driving) to fit against")
    else:
        if d["onset"] is None:
            print(f"  RPM never stayed {CUTBACK_DROP:.0%} below the throttle and battery fit")
        else:
            lo, hi = d["onset_temperature"]
            print(f"  RPM dropped at {(d['onset'] - start) / 60:.1f} min; checks either side "
                  f"read {fmt(lo, ' C')} and {fmt(hi, ' C')}")
        for t, before, after in d["recoveries"]:
            if before >= 1 - CUTBACK_DROP:
                verdict = "no drop before the hold"
            elif after - before > 0.05:
                verdict = "recovered: ESC power cutback"
            else:
                verdict = "did not recover: battery or other cause"
            print(f"  Hold at {(t - start) / 60:.1f} min: RPM/fit {before:.2f} before, "
                  f"{after:.2f} after ({verdict})")

    cooling = []
    for c in checks:
        if c["hold"] and c["hold_minutes"] > 0:
            cooling.append(("Hold", c["reading"], c["end_reading"], c["hold_minutes"]))
    settle = pause if pause is not None else 10
    for t0, t1 in intervals(states, {STOPPED}):
        first = mean_between(motor, "temperature", t0 + settle - READING_WINDOW, t0 + settle)
        last = mean_between(motor, "temperature", t1 - READING_WINDOW, t1)
        minutes = (t1 - t0 - settle) / 60
        if None not in (first, last) and minutes > 0.5:
            cooling.append(("Stop at the end", first, last, minutes))
    print("\nCooling while stopped (3.2.5):")
    for label, first, last, minutes in cooling:
        print(f"  {label}: {fmt(first, ' C')} to {fmt(last, ' C')} in {minutes:.1f} min: "
              f"{(first - last) / minutes:.2f} C/min")
    if not cooling:
        print("  No holds or stops in this run")

    soaks = [c for c in checks if c["soak_rise"] is not None]
    print("\nRise after the motor stops (3.2.6):")
    if soaks:
        worst = max(soaks, key=lambda c: c["soak_rise"])
        print(f"  Largest {worst['soak_rise']:+.1f} C, peaking {worst['soak_seconds']:.0f} s "
              f"after stopping")
    else:
        print("  n/a")

    drifts = drift_rates(bot_status, states)
    print(f"\nDrift while stopped (3.2.7): "
          f"{fmt(float(np.median(drifts)) if drifts else None, ' m/min')}"
          f"{f' (median of {len(drifts)} stops)' if drifts else ''}")

    dive_results = dives(motor, states, bot_status, task_packets)
    print("\nDives (3.2.8 / 3.2.9):")
    for i, dv in enumerate(dive_results, 1):
        rise = (dv["motor_after"] - dv["motor_before"]
                if None not in (dv["motor_after"], dv["motor_before"]) else None)
        print(f"  {i:2d}  before {fmt(dv['motor_before'], ' C', water_c)}  rise {fmt(rise, ' C')}"
              f"  battery {fmt(dv['battery'], ' %', decimals=0)}"
              f"  depth reached {fmt(dv['depth_achieved'], ' m')}")
    if not dive_results:
        print("  No dives in this run")

    if args.csv:
        os.makedirs(args.csv, exist_ok=True)
        with open(os.path.join(args.csv, "checks.csv"), "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(checks[0]) if checks else ["start"])
            writer.writeheader()
            writer.writerows(checks)
        with open(os.path.join(args.csv, "dives.csv"), "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(dive_results[0]) if dive_results
                                    else ["start"])
            writer.writeheader()
            writer.writerows(dive_results)


if __name__ == "__main__":
    main()
