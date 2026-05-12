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
BOTTOM_DIVE_DEPTH_PRIOR_M = 10  # assumed depth when no target depth is planned
HOTEL_LOAD_W = 4.0           # constant hotel load (everything except motor)
# Measured motor draw at known transit speeds (m/s → watts)
MOTOR_POWER_LOOKUP_SPEED = [2.0, 2.2, 3.0]
MOTOR_POWER_LOOKUP_WATTS = [71.0, 75.0, 181.0]


def estimated_transit_energy_wh(distance_m: float, speed_m_s: float) -> float:
    """Compute transit energy in Wh using the hardware-spec motor power curve."""
    if speed_m_s <= 0:
        return 0.0
    motor_w = float(np.interp(speed_m_s, MOTOR_POWER_LOOKUP_SPEED, MOTOR_POWER_LOOKUP_WATTS))
    duration_h = (distance_m / speed_m_s) / 3600
    return (motor_w + HOTEL_LOAD_W) * duration_h


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


def plan_geometry(lats: np.ndarray, lons: np.ndarray) -> tuple[float, float]:
    """
    Compute total turn angle and mean waypoint spacing from a sequence of waypoints.

    Returns (total_turn_angle_deg, mean_waypoint_spacing_m).
    Turn angle at each intermediate waypoint is the angle between the incoming and outgoing
    leg vectors, computed via the dot product in flat-earth approximation (valid for short legs).
    """
    if len(lats) < 2:
        return 0.0, 0.0, 0.0
    dists = haversine(lats[:-1], lons[:-1], lats[1:], lons[1:])
    mean_spacing = float(dists.mean()) if len(dists) > 0 else 0.0
    if len(lats) < 3:
        return 0.0, 0.0, mean_spacing
    # Leg vectors in approximate metres (flat-earth)
    to_rad = np.pi / 180
    avg_lat = lats.mean() * to_rad
    dx = (lons[1:] - lons[:-1]) * to_rad * EARTH_R * np.cos(avg_lat)
    dy = (lats[1:] - lats[:-1]) * to_rad * EARTH_R
    # Dot product between consecutive legs
    dot = dx[:-1] * dx[1:] + dy[:-1] * dy[1:]
    mag_in  = np.sqrt(dx[:-1] ** 2 + dy[:-1] ** 2)
    mag_out = np.sqrt(dx[1:] ** 2 + dy[1:] ** 2)
    valid = (mag_in > 0) & (mag_out > 0)
    cos_angle = np.clip(dot[valid] / (mag_in[valid] * mag_out[valid]), -1.0, 1.0)
    angles = np.degrees(np.arccos(cos_angle))
    total_turn = float(angles.sum())
    mean_turn = float(angles.mean()) if len(angles) > 0 else 0.0
    return total_turn, mean_turn, mean_spacing


def measurement_stops_for_plan(plan: dict) -> int:
    """
    Count total measurement stops across all dive waypoints in a mission plan.
    A measurement stop occurs every depth_interval metres of depth.
    When interval >= depth (or interval is NaN/inf), there is exactly one stop.
    Bottom dives use BOTTOM_DIVE_DEPTH_PRIOR_M as the effective depth.
    """
    DIVE_TASK = 1
    total = 0
    for task_type, interval, max_depth, is_bottom in zip(
        plan["task_type"], plan["intervals"], plan["max_depths"], plan["bottom"]
    ):
        if task_type != DIVE_TASK:
            continue
        depth = BOTTOM_DIVE_DEPTH_PRIOR_M if is_bottom == 1 or is_bottom == 255 else (
            float(max_depth) if not np.isnan(max_depth) else BOTTOM_DIVE_DEPTH_PRIOR_M
        )
        if np.isnan(interval) or interval <= 0 or interval >= depth:
            total += 1
        else:
            total += int(np.ceil(depth / interval))
    return total


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
    lat      = f[f"{base}/location/lat"][:]
    lon      = f[f"{base}/location/lon"][:]
    bot_type = int(f[f"{base}/bot_type"][0])

    # Drop rows where battery is invalid
    valid = ~np.isnan(batt) & (batt > 0)
    batt_v  = batt[valid]
    utime_v = utime[valid]
    state_v = state[valid]
    lat_v   = lat[valid]
    lon_v   = lon[valid]

    segments = find_mission_segments(utime_v, state_v)
    if not segments:
        print(f"  SKIP {log_name}: no active mission segments found")
        f.close()
        return []

    # ── Preload arrays used across all segments ───────────────────────────────

    # Task packets — collect all, filter per segment by utime
    tp_utimes, tp_types, tp_depths, tp_bottom_dives, tp_starts, tp_ends = [], [], [], [], [], []
    for tk in [k for k in f.keys() if k.startswith("jaiabot::task_packet")]:
        base_tp = f"{tk}/jaiabot.protobuf.TaskPacket"
        try:
            tp_utimes.append(f[f"{base_tp}/_utime_"][:])
            tp_types.append(f[f"{base_tp}/type"][:])
            tp_depths.append(f[f"{base_tp}/dive/depth_achieved"][:])
            tp_bottom_dives.append(f[f"{base_tp}/dive/bottom_dive"][:])
            tp_starts.append(f[f"{base_tp}/start_time"][:])
            tp_ends.append(f[f"{base_tp}/end_time"][:])
        except KeyError:
            pass

    tp_utime_all      = np.concatenate(tp_utimes)       if tp_utimes       else np.array([])
    tp_type_all       = np.concatenate(tp_types)        if tp_types        else np.array([])
    tp_depth_all      = np.concatenate(tp_depths)       if tp_depths       else np.array([])
    tp_bottom_all     = np.concatenate(tp_bottom_dives) if tp_bottom_dives else np.array([])
    tp_start_all      = np.concatenate(tp_starts)       if tp_starts       else np.array([])
    tp_end_all        = np.concatenate(tp_ends)         if tp_ends         else np.array([])

    # Deduplicate task packets — same event appears from multiple subscribers
    # microseconds apart. Round to nearest second and keep first per bucket.
    if len(tp_utime_all):
        utime_s = tp_utime_all // 1_000_000
        _, unique_idx = np.unique(utime_s, return_index=True)
        tp_utime_all  = tp_utime_all[unique_idx]
        tp_type_all   = tp_type_all[unique_idx]
        tp_depth_all  = tp_depth_all[unique_idx]
        tp_bottom_all = tp_bottom_all[unique_idx]
        tp_start_all  = tp_start_all[unique_idx]
        tp_end_all    = tp_end_all[unique_idx]

    # Hold phase timestamps from DiveHoldDebug — one row per 1 Hz tick during hold
    hold_utime_all = np.array([])
    if "jaiabot::mission_dive" in f:
        hold_key = "jaiabot::mission_dive/jaiabot.protobuf.DiveHoldDebug/_utime_"
        if hold_key in f:
            hold_utime_all = f[hold_key][:]

    # Hub commands — extract per-waypoint depth_interval for measurement stop counts.
    # Shape is (num_commands, max_waypoints); NaN means waypoint slot is unused.
    hc_plans = []
    if "jaiabot::hub_command" in f:
        hc_base = "jaiabot::hub_command/jaiabot.protobuf.Command"
        try:
            hc_utime      = f[f"{hc_base}/_utime_"][:]
            hc_cmd_type   = f[f"{hc_base}/type"][:]
            hc_lats       = f[f"{hc_base}/plan/goal/location/lat"][:]
            hc_lons       = f[f"{hc_base}/plan/goal/location/lon"][:]
            hc_intervals  = f[f"{hc_base}/plan/goal/task/dive/depth_interval"][:]
            hc_max_depths = f[f"{hc_base}/plan/goal/task/dive/max_depth"][:]
            hc_bottom     = f[f"{hc_base}/plan/goal/task/dive/bottom_dive"][:]
            hc_task_type  = f[f"{hc_base}/plan/goal/task/type"][:]
            hc_speeds     = f[f"{hc_base}/plan/speeds/transit"][:]
            hc_ch_speed   = f[f"{hc_base}/plan/goal/task/constant_heading/constant_heading_speed"][:]
            hc_ch_time    = f[f"{hc_base}/plan/goal/task/constant_heading/constant_heading_time"][:]
            hc_drift_time = f[f"{hc_base}/plan/goal/task/surface_drift/drift_time"][:]
            hc_sk_time    = f[f"{hc_base}/plan/goal/task/station_keep/station_keep_time"][:]
            hc_repeats    = f[f"{hc_base}/plan/repeats"][:]
            UINT32_MAX = 4_294_967_295
            INT_MAX    = 2_147_483_647
            # Keep only MISSION_PLAN commands (type=1) that have at least one waypoint
            for i, (ct, t) in enumerate(zip(hc_cmd_type, hc_utime)):
                if ct != 1:
                    continue
                valid_wp = ~np.isnan(hc_lats[i])
                if not valid_wp.any():
                    continue
                speed = float(hc_speeds[i]) if not np.isnan(hc_speeds[i]) else 2.0
                raw_repeats = int(hc_repeats[i])
                repeats = 1 if raw_repeats == UINT32_MAX else raw_repeats
                lats_wp = hc_lats[i][valid_wp]
                lons_wp = hc_lons[i][valid_wp]
                wp_dists = haversine(lats_wp[:-1], lons_wp[:-1], lats_wp[1:], lons_wp[1:])
                tt = hc_task_type[i][valid_wp]
                ch_spd = hc_ch_speed[i][valid_wp]
                ch_t   = hc_ch_time[i][valid_wp]
                drift_t = hc_drift_time[i][valid_wp]
                sk_t    = hc_sk_time[i][valid_wp]
                hc_plans.append({
                    "utime":         t,
                    "transit_speed": speed,
                    "repeats":       repeats,
                    "distance_m":    float(wp_dists.sum()),
                    "lats":          lats_wp,
                    "lons":          lons_wp,
                    "task_type":     tt,
                    "intervals":     hc_intervals[i][valid_wp],
                    "max_depths":    hc_max_depths[i][valid_wp],
                    "bottom":        hc_bottom[i][valid_wp],
                    "ch_speed":      np.where(np.isnan(ch_spd), 0.0, ch_spd),
                    "ch_time":       np.where(ch_t == INT_MAX, 0, ch_t),
                    "drift_time":    np.where((drift_t == INT_MAX) | np.isnan(drift_t.astype(float)), 0, drift_t),
                    "sk_time":       np.where(sk_t == INT_MAX, 0, sk_t),
                })
        except KeyError:
            pass

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

        # Plan-derived features from the hub_command sent most recently before this segment
        dive_hold_stops      = 0
        transit_energy_wh    = 0.0
        drift_count          = 0
        drift_total_s        = 0.0
        station_keep_count   = 0
        station_keep_total_s = 0.0
        SURFACE_DRIFT    = 3
        STATION_KEEP     = 2
        CONSTANT_HEADING = 4
        prior_plans = [p for p in hc_plans if p["utime"] <= t0]
        if prior_plans:
            closest_plan = max(prior_plans, key=lambda p: p["utime"])
            plan_repeats = closest_plan["repeats"]
            dive_hold_stops = measurement_stops_for_plan(closest_plan) * plan_repeats
            single_pass_energy = estimated_transit_energy_wh(
                closest_plan["distance_m"], closest_plan["transit_speed"]
            )
            for tt, ch_spd, ch_t, dr_t, sk_t in zip(
                closest_plan["task_type"],
                closest_plan["ch_speed"],
                closest_plan["ch_time"],
                closest_plan["drift_time"],
                closest_plan["sk_time"],
            ):
                if tt == CONSTANT_HEADING and ch_spd > 0 and ch_t > 0:
                    ch_dist = float(ch_spd) * float(ch_t)
                    single_pass_energy += estimated_transit_energy_wh(ch_dist, float(ch_spd))
                elif tt == SURFACE_DRIFT:
                    drift_count += 1
                    drift_total_s += float(dr_t)
                elif tt == STATION_KEEP:
                    station_keep_count += 1
                    station_keep_total_s += float(sk_t)
            drift_count          *= plan_repeats
            drift_total_s        *= plan_repeats
            station_keep_count   *= plan_repeats
            station_keep_total_s *= plan_repeats
            lats_wp = closest_plan["lats"]
            lons_wp = closest_plan["lons"]
            total_turn_angle_deg, mean_turn_angle_deg, mean_waypoint_spacing_m = plan_geometry(lats_wp, lons_wp)
            # Leg from bot's position at mission start to first waypoint
            start_lat = float(lat_v[s])
            start_lon = float(lon_v[s])
            to_first_dist_m = float(haversine(start_lat, start_lon, lats_wp[0], lons_wp[0]))
            to_first_energy = estimated_transit_energy_wh(to_first_dist_m, closest_plan["transit_speed"])
            # Return leg from last waypoint back to first, paid (repeats-1) times
            return_dist_m = float(haversine(lats_wp[-1], lons_wp[-1], lats_wp[0], lons_wp[0]))
            return_energy = estimated_transit_energy_wh(return_dist_m, closest_plan["transit_speed"])
            transit_energy_wh = to_first_energy + single_pass_energy * plan_repeats + return_energy * (plan_repeats - 1)

        # Task packets within window
        dive_count      = 0
        dive_depth_m  = 0.0
        dive_hold_s = 0.0
        if len(tp_utime_all):
            in_tp     = (tp_utime_all >= t0) & (tp_utime_all <= t1)
            dive_mask = in_tp & (tp_type_all == 1)
            dive_count = int(dive_mask.sum())

            for d_start, d_end, depth, is_bottom in zip(
                tp_start_all[dive_mask],
                tp_end_all[dive_mask],
                tp_depth_all[dive_mask],
                tp_bottom_all[dive_mask],
            ):
                # Depth: use prior for bottom dives to match inference behaviour
                if is_bottom == 1:
                    dive_depth_m += BOTTOM_DIVE_DEPTH_PRIOR_M
                elif not np.isnan(depth) and depth > 0:
                    dive_depth_m += float(depth)

                # Hold time: span of DiveHoldDebug ticks within this dive's window
                if len(hold_utime_all):
                    in_hold = (hold_utime_all >= d_start) & (hold_utime_all <= d_end)
                    hold_ticks = hold_utime_all[in_hold]
                    if len(hold_ticks) >= 2:
                        dive_hold_s += float((hold_ticks[-1] - hold_ticks[0]) / 1e6)

        rows.append({
            "log_file":                   log_name,
            "mission_num":                mission_num,
            "bot_type":                   bot_type,
            "transit_energy_wh":          round(transit_energy_wh, 4),
            "total_turn_angle_deg":       round(total_turn_angle_deg, 1),
            "mean_turn_angle_deg":        round(mean_turn_angle_deg, 1),
            "mean_waypoint_spacing_m":    round(mean_waypoint_spacing_m, 1),
            "drift_count":                drift_count,
            "drift_total_s":              round(drift_total_s, 1),
            "station_keep_count":         station_keep_count,
            "station_keep_total_s":       round(station_keep_total_s, 1),
            "dive_count":                 dive_count,
            "dive_depth_m":               round(dive_depth_m, 2),
            "dive_hold_s":                round(dive_hold_s, 1),
            "dive_hold_stops":            dive_hold_stops,
            "starting_battery_pct":       round(starting_battery_pct, 1),
            "battery_drain_pct":          round(battery_drain_pct, 1),
        })

    return rows


FIELDNAMES = [
    "log_file",
    "mission_num",
    "bot_type",
    "transit_energy_wh",
    "total_turn_angle_deg",
    "mean_turn_angle_deg",
    "mean_waypoint_spacing_m",
    "drift_count",
    "drift_total_s",
    "station_keep_count",
    "station_keep_total_s",
    "dive_count",
    "dive_depth_m",
    "dive_hold_s",
    "dive_hold_stops",
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
                  f"transit={row['transit_energy_wh']:.2f}Wh  "
                  f"dives={row['dive_count']}")

    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWrote {len(all_rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
