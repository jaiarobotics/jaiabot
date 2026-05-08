#!/usr/bin/env python3
"""
Extract per-mission features from HDF5 bot logs and write a CSV dataset.

Each log may contain multiple missions. A mission is identified by a
transition from a rest state (pre-deployment or RECOVERY__STOPPED) into
TRANSIT (110), ending when the bot reaches RECOVERY__TRANSIT (140).
RECOVERY__STATION_KEEP (141) is used as the post-mission battery anchor.
Short runs under MIN_MISSION_DURATION_S are discarded.

Usage:
    python3 extract_features.py --logs-dir /path/to/logs --output dataset.csv
"""

import argparse
import csv
import glob
import os

import h5py
import numpy as np

EARTH_R = 6_371_000  # metres
GPS_JUMP_THRESHOLD_M = 100  # filter GPS teleports
MIN_MISSION_DURATION_S = 300  # 5 minutes — discard short test runs


def is_active_mission_state(state: int) -> bool:
    """True for active work states. Excludes RECOVERY__STATION_KEEP (141),
    RECOVERY__STOPPED (142), and all pre-deployment states (< 100)."""
    return (100 <= state < 141) or (150 <= state < 170)


def haversine(lat1, lon1, lat2, lon2):
    to_rad = np.pi / 180
    dlat = (lat2 - lat1) * to_rad
    dlon = (lon2 - lon1) * to_rad
    h = (
        np.sin(dlat / 2) ** 2
        + np.cos(lat1 * to_rad) * np.cos(lat2 * to_rad) * np.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(h, 0, 1)))


def find_mission_segments(utime, state):
    """
    Find missions by detecting transitions from a rest state into TRANSIT (110).

    A rest state is pre-deployment (state < 100) or RECOVERY__STOPPED (142).
    The active window runs from that first TRANSIT (110) to the first
    RECOVERY__STATION_KEEP (141), inclusive of RECOVERY__TRANSIT (140) since
    the bot is still motoring back to the recovery point.

    Returns list of (active_start, active_end) indices.
    """
    segments = []

    # Find every index where state transitions into TRANSIT (110)
    transit_entries = [
        i for i in range(1, len(state))
        if state[i] == 110 and not is_active_mission_state(int(state[i - 1]))
    ]

    RC_STATES = {112, 113, 114}

    for start_idx in transit_entries:
        # Mission ends when RECOVERY__STATION_KEEP (141) is reached —
        # bot has returned to the recovery point and motor has stopped.
        # RECOVERY__TRANSIT (140) is still active motor use so it stays
        # inside the feature window.
        station_keep = np.where(state[start_idx:] == 141)[0]
        if len(station_keep) == 0:
            continue
        active_end = start_idx + int(station_keep[0])

        window = state[start_idx:active_end]

        # Drop missions that contain any remote control states
        if any(int(s) in RC_STATES for s in window):
            continue

        # Drop missions where RECOVERY__STOPPED (142) appears inside the window —
        # the bot stopped mid-mission and resumed, making the data unreliable.
        if (window == 142).any():
            continue

        duration_s = (utime[active_end - 1] - utime[start_idx]) / 1e6
        if duration_s < MIN_MISSION_DURATION_S:
            continue

        segments.append((start_idx, active_end))

    return segments


def extract_missions(h5_path: str) -> list[dict]:
    """Return a list of feature dicts, one per mission found in the log."""
    f = h5py.File(h5_path, "r")
    log_name = os.path.basename(h5_path)

    # ── Bot status — pick the group with the most samples ────────────────────
    status_keys = [k for k in f.keys() if k.startswith("jaiabot::bot_status")]
    if not status_keys:
        print(f"  SKIP {log_name}: no bot_status group")
        f.close()
        return []

    status_keys.sort(
        key=lambda k: f[f"{k}/jaiabot.protobuf.BotStatus/_utime_"].shape[0],
        reverse=True,
    )
    base = f"{status_keys[0]}/jaiabot.protobuf.BotStatus"

    batt     = f[f"{base}/battery_percent"][:]
    utime    = f[f"{base}/_utime_"][:]
    state    = f[f"{base}/mission_state"][:]
    bot_type = int(f[f"{base}/bot_type"][0])

    # Drop rows where battery is invalid
    valid = ~np.isnan(batt) & (batt > 0)
    batt_v  = batt[valid]
    utime_v = utime[valid]
    state_v = state[valid]

    segments = find_mission_segments(utime_v, state_v)
    if not segments:
        print(f"  SKIP {log_name}: no active mission segments found")
        f.close()
        return []

    # ── Preload arrays used across all segments ───────────────────────────────
    lat   = f[f"{base}/location/lat"][:]
    lon   = f[f"{base}/location/lon"][:]
    speed = f[f"{base}/speed/over_ground"][:]
    lat_v   = lat[valid]
    lon_v   = lon[valid]
    speed_v = speed[valid]

    # Task packets — collect all, filter per segment by utime
    tp_utimes, tp_types, tp_depths = [], [], []
    for tk in [k for k in f.keys() if k.startswith("jaiabot::task_packet")]:
        base_tp = f"{tk}/jaiabot.protobuf.TaskPacket"
        try:
            tp_utimes.append(f[f"{base_tp}/_utime_"][:])
            tp_types.append(f[f"{base_tp}/type"][:])
            tp_depths.append(f[f"{base_tp}/dive/depth_achieved"][:])
        except KeyError:
            pass

    tp_utime_all = np.concatenate(tp_utimes) if tp_utimes else np.array([])
    tp_type_all  = np.concatenate(tp_types)  if tp_types  else np.array([])
    tp_depth_all = np.concatenate(tp_depths) if tp_depths else np.array([])

    # Deduplicate task packets — same event appears from multiple subscribers
    # microseconds apart. Round to nearest second and keep first per bucket.
    if len(tp_utime_all):
        utime_s = tp_utime_all // 1_000_000
        _, unique_idx = np.unique(utime_s, return_index=True)
        tp_utime_all = tp_utime_all[unique_idx]
        tp_type_all  = tp_type_all[unique_idx]
        tp_depth_all = tp_depth_all[unique_idx]

    # Water temperature
    temp_utime_all = np.array([])
    temp_all       = np.array([])
    if "jaiabot::pressure_temperature" in f:
        pt_base = "jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData"
        temp_utime_all = f[f"{pt_base}/_utime_"][:]
        temp_all       = f[f"{pt_base}/temperature"][:]

    f.close()

    # ── Extract features per segment ─────────────────────────────────────────
    rows = []
    for mission_num, (s, e) in enumerate(segments, start=1):
        t0 = utime_v[s]
        t1 = utime_v[e - 1]
        duration_s = float((t1 - t0) / 1e6)

        # Starting battery: last rest-state reading before segment.
        # Rest states: pre-deployment (< 100), RECOVERY__STATION_KEEP (141), or RECOVERY__STOPPED (142).
        rest_before = ((state_v[:s] < 100) | (state_v[:s] == 141) | (state_v[:s] == 142)) & ~np.isnan(batt_v[:s]) & (batt_v[:s] > 0)
        if rest_before.any():
            starting_battery_pct = float(batt_v[:s][rest_before][-1])
        else:
            starting_battery_pct = float(batt_v[s])

        # Ending battery: first RECOVERY__STATION_KEEP (141) reading after active_end.
        post_mask = (state_v[e:] == 141) & ~np.isnan(batt_v[e:]) & (batt_v[e:] > 0)
        if post_mask.any():
            ending_battery_pct = float(batt_v[e:][post_mask][0])
        else:
            ending_battery_pct = float(batt_v[e - 1])

        battery_drain_pct = starting_battery_pct - ending_battery_pct

        if battery_drain_pct <= 0:
            print(f"  SKIP {log_name} mission {mission_num}: non-positive drain ({battery_drain_pct:.1f}%)")
            continue

        # GPS distance within window
        lat_w  = lat_v[s:e]
        lon_w  = lon_v[s:e]
        spd_w  = speed_v[s:e]

        good_gps = (lat_w != 0) & (lon_w != 0) & ~np.isnan(lat_w) & ~np.isnan(lon_w)
        total_distance_m = 0.0
        if good_gps.sum() > 1:
            lg, gg = lat_w[good_gps], lon_w[good_gps]
            dists = haversine(lg[:-1], gg[:-1], lg[1:], gg[1:])
            total_distance_m = float(dists[dists < GPS_JUMP_THRESHOLD_M].sum())

        # Mean speed within window
        spd_valid = spd_w[(spd_w > 0) & (spd_w < 10) & ~np.isnan(spd_w)]
        mean_speed_m_per_s = float(spd_valid.mean()) if len(spd_valid) else 2.0

        motor_energy_proxy = total_distance_m * mean_speed_m_per_s

        # Task packets within window
        num_dives    = 0
        total_depth_m = 0.0
        if len(tp_utime_all):
            in_tp = (tp_utime_all >= t0) & (tp_utime_all <= t1)
            dive_mask = in_tp & (tp_type_all == 1)
            num_dives = int(dive_mask.sum())
            depths = tp_depth_all[dive_mask]
            depths = depths[~np.isnan(depths) & (depths > 0)]
            total_depth_m = float(depths.sum())

        # Water temperature within window
        mean_water_temp_C = float("nan")
        if len(temp_utime_all):
            in_temp = (temp_utime_all >= t0) & (temp_utime_all <= t1)
            temp_w = temp_all[in_temp]
            temp_w = temp_w[(temp_w > -5) & (temp_w < 50) & ~np.isnan(temp_w)]
            if len(temp_w):
                mean_water_temp_C = float(temp_w.mean())

        rows.append({
            "log_file":             log_name,
            "mission_num":          mission_num,
            "bot_type":             bot_type,
            "duration_s":           round(duration_s, 1),
            "total_distance_m":     round(total_distance_m, 1),
            "mean_speed_m_per_s":   round(mean_speed_m_per_s, 3),
            "motor_energy_proxy":   round(motor_energy_proxy, 1),
            "num_dives":            num_dives,
            "total_depth_m":        round(total_depth_m, 2),
            "mean_water_temp_C":    round(mean_water_temp_C, 2) if not np.isnan(mean_water_temp_C) else "",
            "starting_battery_pct": round(starting_battery_pct, 1),
            "battery_drain_pct":    round(battery_drain_pct, 1),
        })

    return rows


FIELDNAMES = [
    "log_file",
    "mission_num",
    "bot_type",
    "duration_s",
    "total_distance_m",
    "mean_speed_m_per_s",
    "motor_energy_proxy",
    "num_dives",
    "total_depth_m",
    "mean_water_temp_C",
    "starting_battery_pct",
    "battery_drain_pct",
]


def main():
    parser = argparse.ArgumentParser(
        description="Extract battery prediction features from HDF5 logs"
    )
    parser.add_argument("--logs-dir", required=True, help="Directory containing .h5 log files")
    parser.add_argument("--output", required=True, help="Output CSV path")
    args = parser.parse_args()

    h5_files = sorted(glob.glob(os.path.join(args.logs_dir, "*.h5")))
    if not h5_files:
        print(f"No .h5 files found in {args.logs_dir}")
        return

    all_rows = []
    for path in h5_files:
        print(f"Processing {os.path.basename(path)} ...")
        rows = extract_missions(path)
        for row in rows:
            all_rows.append(row)
            print(f"  mission {row['mission_num']}: drain={row['battery_drain_pct']}%  "
                  f"dur={row['duration_s']/60:.1f}min  dist={row['total_distance_m']:.0f}m  "
                  f"dives={row['num_dives']}")

    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWrote {len(all_rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
