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

from .calibration import load_calibration
from .geo import EARTH_R, haversine

GPS_JUMP_THRESHOLD_M = 100  # filter GPS teleports
MIN_MISSION_DURATION_S = 300  # 5 minutes — discard short test runs
BOTTOM_DIVE_DEPTH_PRIOR_M = 10  # assumed depth when no target depth is planned
HOTEL_LOAD_W = 4.0           # constant hotel load when motor is genuinely off

CALIBRATION = load_calibration()


def estimated_transit_energy_wh(distance_m: float, speed_m_s: float) -> float:
    """Compute transit energy in Wh using the calibrated planned-speed -> watts
    curve from calibration.json. The curve already includes hotel load because
    it's measured from total battery current, not motor-only."""
    if speed_m_s <= 0:
        return 0.0
    motor_w = float(np.interp(
        speed_m_s,
        CALIBRATION["transit_speeds_m_s"],
        CALIBRATION["transit_watts"],
    ))
    duration_h = (distance_m / speed_m_s) / 3600
    return motor_w * duration_h


INT32_MAX = 2_147_483_647


def find_mission_segments(hc_plans, utime, state, active_goal):
    """
    Build mission segments from hub MISSION_PLAN commands.

    Each unique hub command (deduped by the hub-side `hub_time` field) defines
    one mission. Mission end is determined by:
      - the next unique hub command (end_reason = "superseded"), else
      - the first RECOVERY__STATION_KEEP (141) after the command (end_reason =
        "station_keep"), else
      - the time when active_goal last advanced (end_reason = "truncated"),
        with the plan truncated to the goals that were actually completed.

    Returns list of dicts with keys: plan (the hub command dict, possibly
    plan-truncated), start_idx, end_idx, end_reason, n_completed.
    """
    # Dedupe by hub_time, keeping the earliest reception (smallest utime).
    by_time = {}
    for p in hc_plans:
        t = int(p["hub_time"])
        if t not in by_time or p["utime"] < by_time[t]["utime"]:
            by_time[t] = p
    unique = sorted(by_time.values(), key=lambda p: int(p["hub_time"]))
    if not unique:
        return []

    segments = []
    for i, plan in enumerate(unique):
        t_start = int(plan["utime"])
        n_wp = len(plan["lats"])

        if i + 1 < len(unique):
            t_end = int(unique[i + 1]["utime"])
            end_reason = "superseded"
            n_completed = n_wp
        else:
            after = utime >= t_start
            sk_idx = np.where(after & (state == 141))[0]
            if len(sk_idx) > 0:
                t_end = int(utime[sk_idx[0]])
                end_reason = "station_keep"
                n_completed = n_wp
            else:
                ag_in = active_goal[after]
                u_in = utime[after]
                if len(ag_in) == 0:
                    continue
                # If active_goal reached INT_MAX, all goals were completed even
                # though the bot didn't reach 141 (log may have ended early).
                int_max_pos = np.where(ag_in == INT32_MAX)[0]
                if len(int_max_pos) > 0:
                    t_end = int(u_in[int_max_pos[0]])
                    end_reason = "all_goals_completed"
                    n_completed = n_wp
                else:
                    ag_finite = ag_in[ag_in < INT32_MAX]
                    if len(ag_finite) == 0:
                        continue
                    max_ag = int(ag_finite.max())
                    if max_ag <= 1:
                        continue  # bot didn't complete any goal
                    n_completed = max_ag - 1
                    first_reach = int(np.argmax(ag_in == max_ag))
                    t_end = int(u_in[first_reach])
                    end_reason = "truncated"

        if t_end <= t_start:
            continue
        # Truncated missions can be short by design (bot stopped after reaching
        # only a handful of goals). Skip the duration filter in that case so we
        # don't waste a real data point.
        if end_reason != "truncated" and (t_end - t_start) / 1e6 < MIN_MISSION_DURATION_S:
            continue

        start_idx = int(np.searchsorted(utime, t_start))
        end_idx = int(np.searchsorted(utime, t_end))
        if end_idx <= start_idx:
            continue

        used_plan = plan
        if n_completed < n_wp:
            used_plan = _truncate_plan(plan, n_completed)

        segments.append({
            "plan":        used_plan,
            "start_idx":   start_idx,
            "end_idx":     end_idx,
            "t_start":     t_start,
            "t_end":       t_end,
            "end_reason":  end_reason,
            "n_completed": n_completed,
            "n_planned":   n_wp,
        })

    return segments


def _truncate_plan(plan: dict, n: int) -> dict:
    """Return a copy of `plan` with all per-waypoint arrays truncated to first n.

    `repeats` is forced to 1: the bot stopped before finishing even one pass,
    so any planned repeat shouldn't be counted toward transit energy.
    """
    truncated = dict(plan)
    truncated["lats"]       = plan["lats"][:n]
    truncated["lons"]       = plan["lons"][:n]
    truncated["task_type"]  = plan["task_type"][:n]
    truncated["intervals"]  = plan["intervals"][:n]
    truncated["max_depths"] = plan["max_depths"][:n]
    truncated["hold_times"] = plan["hold_times"][:n]
    truncated["bottom"]     = plan["bottom"][:n]
    truncated["ch_speed"]   = plan["ch_speed"][:n]
    truncated["ch_time"]    = plan["ch_time"][:n]
    truncated["drift_time"] = plan["drift_time"][:n]
    truncated["sk_time"]    = plan["sk_time"][:n]
    truncated["repeats"]    = 1
    wp_dists = haversine(
        truncated["lats"][:-1], truncated["lons"][:-1],
        truncated["lats"][1:],  truncated["lons"][1:],
    )
    truncated["distance_m"] = float(wp_dists.sum()) if n > 1 else 0.0
    return truncated


def plan_geometry(lats: np.ndarray, lons: np.ndarray) -> tuple[float, float, float]:
    """
    Compute turning geometry features from a sequence of waypoints.

    Returns (total_turn_angle_deg, mean_turn_angle_deg, turn_density_deg_per_km).
    Turn angle at each intermediate waypoint is the angle between the incoming and outgoing
    leg vectors, computed via the dot product in flat-earth approximation (valid for short legs).
    Turn density is total turn angle divided by total distance in km, capturing turning
    intensity normalised to mission length.
    """
    if len(lats) < 3:
        return 0.0, 0.0, 0.0
    dists = haversine(lats[:-1], lons[:-1], lats[1:], lons[1:])
    total_distance_km = float(dists.sum()) / 1000
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
    turn_density = total_turn / total_distance_km if total_distance_km > 0 else 0.0
    return total_turn, mean_turn, turn_density


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

    batt        = f[f"{base}/battery_percent"][:]
    utime       = f[f"{base}/_utime_"][:]
    state       = f[f"{base}/mission_state"][:]
    lat         = f[f"{base}/location/lat"][:]
    lon         = f[f"{base}/location/lon"][:]
    active_goal = f[f"{base}/active_goal"][:]
    bot_type    = int(f[f"{base}/bot_type"][0])

    # Drop rows where battery is invalid
    valid = ~np.isnan(batt) & (batt > 0)
    batt_v  = batt[valid]
    utime_v = utime[valid]
    state_v = state[valid]
    lat_v   = lat[valid]
    lon_v   = lon[valid]
    ag_v    = active_goal[valid]

    # ── Preload hub commands ──────────────────────────────────────────────────
    # All mission features (transit energy, dive counts/depths/holds, etc.) are
    # derived from the hub-sent plan so training matches what the web inference
    # client computes from the same plan at prediction time.
    # Shape is (num_commands, max_waypoints); NaN means waypoint slot is unused.
    hc_plans = []
    if "jaiabot::hub_command" in f:
        hc_base = "jaiabot::hub_command/jaiabot.protobuf.Command"
        try:
            hc_utime      = f[f"{hc_base}/_utime_"][:]
            hc_time       = f[f"{hc_base}/time"][:]
            hc_cmd_type   = f[f"{hc_base}/type"][:]
            hc_lats       = f[f"{hc_base}/plan/goal/location/lat"][:]
            hc_lons       = f[f"{hc_base}/plan/goal/location/lon"][:]
            hc_intervals  = f[f"{hc_base}/plan/goal/task/dive/depth_interval"][:]
            hc_max_depths = f[f"{hc_base}/plan/goal/task/dive/max_depth"][:]
            hc_hold_times = f[f"{hc_base}/plan/goal/task/dive/hold_time"][:]
            hc_bottom     = f[f"{hc_base}/plan/goal/task/dive/bottom_dive"][:]
            hc_task_type  = f[f"{hc_base}/plan/goal/task/type"][:]
            hc_speeds     = f[f"{hc_base}/plan/speeds/transit"][:]
            hc_ch_speed   = f[f"{hc_base}/plan/goal/task/constant_heading/constant_heading_speed"][:]
            hc_ch_time    = f[f"{hc_base}/plan/goal/task/constant_heading/constant_heading_time"][:]
            hc_drift_time = f[f"{hc_base}/plan/goal/task/surface_drift/drift_time"][:]
            hc_sk_time    = f[f"{hc_base}/plan/goal/task/station_keep/station_keep_time"][:]
            hc_repeats    = f[f"{hc_base}/plan/repeats"][:]
            UINT32_MAX = 4_294_967_295
            # Keep only MISSION_PLAN commands (type=1) that have at least one waypoint
            for i, ct in enumerate(hc_cmd_type):
                if ct != 1:
                    continue
                valid_wp = ~np.isnan(hc_lats[i])
                if not valid_wp.any():
                    continue
                speed = float(hc_speeds[i]) if not np.isnan(hc_speeds[i]) else 2.0
                # Empirical floor: when commanded below 2.0 m/s the bot still
                # achieves ~1.7 m/s in the logs (planned 1.0 -> achieved 1.73,
                # planned 2.0 -> achieved 1.63) because the motor has a
                # minimum-throttle floor. Clamping at 2.0 keeps both the
                # transit-time and the wattage lookup honest for slow plans.
                if speed < 2.0:
                    speed = 2.0
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
                    "utime":         int(hc_utime[i]),
                    "hub_time":      int(hc_time[i]),
                    "transit_speed": speed,
                    "repeats":       repeats,
                    "distance_m":    float(wp_dists.sum()),
                    "lats":          lats_wp,
                    "lons":          lons_wp,
                    "task_type":     tt,
                    "intervals":     hc_intervals[i][valid_wp],
                    "max_depths":    hc_max_depths[i][valid_wp],
                    "hold_times":    np.where(np.isnan(hc_hold_times[i][valid_wp]), 0.0, hc_hold_times[i][valid_wp]),
                    "bottom":        hc_bottom[i][valid_wp],
                    "ch_speed":      np.where(np.isnan(ch_spd), 0.0, ch_spd),
                    "ch_time":       np.where(ch_t == INT32_MAX, 0, ch_t),
                    "drift_time":    np.where((drift_t == INT32_MAX) | np.isnan(drift_t.astype(float)), 0, drift_t),
                    "sk_time":       np.where(sk_t == INT32_MAX, 0, sk_t),
                })
        except KeyError:
            pass

    f.close()

    segments = find_mission_segments(hc_plans, utime_v, state_v, ag_v)
    if not segments:
        print(f"  SKIP {log_name}: no missions found from hub commands")
        return []

    # ── Extract features per segment ─────────────────────────────────────────
    rows = []
    DIVE_TASK        = 1
    STATION_KEEP     = 2
    SURFACE_DRIFT    = 3
    CONSTANT_HEADING = 4
    for mission_num, seg in enumerate(segments, start=1):
        s          = seg["start_idx"]
        plan       = seg["plan"]
        end_reason = seg["end_reason"]

        # Starting battery: last reading at or before t_start
        if s == 0:
            starting_battery_pct = float(batt_v[0])
        else:
            starting_battery_pct = float(batt_v[s - 1])

        # Ending battery: last reading within window (closest sample to t_end)
        ending_battery_pct = float(batt_v[min(seg["end_idx"], len(batt_v)) - 1])

        battery_drain_pct = starting_battery_pct - ending_battery_pct

        if battery_drain_pct <= 0:
            print(f"  SKIP {log_name} mission {mission_num}: non-positive drain ({battery_drain_pct:.1f}%)")
            continue

        # Plan-derived features (plan is already truncated by find_mission_segments if needed).
        # All dive features (count/depth/hold/stops) come from the plan so training
        # matches what the web inference client computes from the same plan.
        plan_repeats = plan["repeats"]
        transit_speed = plan["transit_speed"]
        dive_hold_stops = measurement_stops_for_plan(plan) * plan_repeats
        single_pass_distance_m = plan["distance_m"]
        single_pass_energy = estimated_transit_energy_wh(
            single_pass_distance_m, transit_speed
        )
        single_pass_extra_time_s = 0.0  # CONSTANT_HEADING segments add time per pass
        drift_total_s        = 0.0
        station_keep_total_s = 0.0
        dive_count           = 0
        dive_depth_m         = 0.0
        dive_hold_s          = 0.0
        for tt, ch_spd, ch_t, dr_t, sk_t, max_d, hold_t, is_bottom in zip(
            plan["task_type"],
            plan["ch_speed"],
            plan["ch_time"],
            plan["drift_time"],
            plan["sk_time"],
            plan["max_depths"],
            plan["hold_times"],
            plan["bottom"],
        ):
            if tt == DIVE_TASK:
                dive_count += 1
                if is_bottom == 1:
                    dive_depth_m += BOTTOM_DIVE_DEPTH_PRIOR_M
                elif not np.isnan(max_d) and max_d > 0:
                    dive_depth_m += float(max_d)
                dive_hold_s += float(hold_t)
            elif tt == CONSTANT_HEADING and ch_spd > 0 and ch_t > 0:
                ch_dist = float(ch_spd) * float(ch_t)
                single_pass_energy += estimated_transit_energy_wh(ch_dist, float(ch_spd))
                single_pass_extra_time_s += float(ch_t)
            elif tt == SURFACE_DRIFT:
                drift_total_s += float(dr_t)
            elif tt == STATION_KEEP:
                station_keep_total_s += float(sk_t)
        dive_count           *= plan_repeats
        dive_depth_m         *= plan_repeats
        dive_hold_s          *= plan_repeats
        drift_total_s        *= plan_repeats
        station_keep_total_s *= plan_repeats
        mean_dive_depth_m = dive_depth_m / dive_count if dive_count > 0 else 0.0

        lats_wp = plan["lats"]
        lons_wp = plan["lons"]
        _, _, turn_density_deg_per_km = plan_geometry(lats_wp, lons_wp)
        # Leg from bot's position at mission start to first waypoint
        start_lat = float(lat_v[s])
        start_lon = float(lon_v[s])
        to_first_dist_m = float(haversine(start_lat, start_lon, lats_wp[0], lons_wp[0]))
        to_first_energy = estimated_transit_energy_wh(to_first_dist_m, transit_speed)
        # Return leg from last waypoint back to first, paid (repeats-1) times
        return_dist_m = float(haversine(lats_wp[-1], lons_wp[-1], lats_wp[0], lons_wp[0]))
        return_energy = estimated_transit_energy_wh(return_dist_m, transit_speed)
        transit_energy_wh = to_first_energy + single_pass_energy * plan_repeats + return_energy * (plan_repeats - 1)

        # Transit time in seconds. Drives both motor wattage (already in
        # transit_energy_wh) and hotel-load wattage while moving.
        single_pass_time_s = single_pass_distance_m / transit_speed + single_pass_extra_time_s
        to_first_time_s    = to_first_dist_m / transit_speed
        return_time_s      = return_dist_m / transit_speed
        transit_time_s = to_first_time_s + single_pass_time_s * plan_repeats + return_time_s * (plan_repeats - 1)

        # Convert each non-transit task duration to its own calibrated energy
        # in Wh using per-state median wattages measured from logs by
        # calibrate.py. Each task has a different physical power draw (motor
        # off on surface drift, motor active at depth in dive hold, etc.) so
        # rolling them up with a single hotel constant would mis-attribute
        # drain. Summing into a single hotel_energy_wh gives the model one
        # physically monotonic feature with the correct scale.
        hotel_energy_wh = (
            CALIBRATION["dive_hold_w"]     * dive_hold_s          +
            CALIBRATION["surface_drift_w"] * drift_total_s        +
            CALIBRATION["station_keep_w"]  * station_keep_total_s
        ) / 3600.0

        # Each completed dive cycle (descent → hold → ascent → reacquire GPS)
        # has a roughly fixed energy cost plus a depth-dependent term, both
        # fit from log data by calibrate.py. Multiplying by dive_count gives a
        # planning-time estimate of total dive-cycle energy in Wh.
        dive_energy_wh = dive_count * (
            CALIBRATION["dive_energy_base_wh"] +
            CALIBRATION["dive_energy_per_m"] * mean_dive_depth_m
        )

        rows.append({
            "log_file":                   log_name,
            "mission_num":                mission_num,
            "bot_type":                   bot_type,
            "end_reason":                 end_reason,
            "transit_energy_wh":          round(transit_energy_wh, 4),
            "transit_time_s":             round(transit_time_s, 1),
            "turn_density_deg_per_km":    round(turn_density_deg_per_km, 1),
            "hotel_energy_wh":            round(hotel_energy_wh, 4),
            "dive_energy_wh":             round(dive_energy_wh, 4),
            "dive_hold_stops":            dive_hold_stops,
            "starting_battery_pct":       round(starting_battery_pct, 1),
            "battery_drain_pct":          round(battery_drain_pct, 1),
        })

    return rows


FIELDNAMES = [
    "log_file",
    "mission_num",
    "bot_type",
    "end_reason",
    "transit_energy_wh",
    "transit_time_s",
    "turn_density_deg_per_km",
    "hotel_energy_wh",
    "dive_energy_wh",
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
                  f"hotel={row['hotel_energy_wh']:.2f}Wh  "
                  f"dive={row['dive_energy_wh']:.2f}Wh")

    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nWrote {len(all_rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
