#!/usr/bin/env python3
"""
align_ctd.py
Extract, window, and align JaiaBot CTD streams from an H5 into a single DataFrame.
Returns columns:
  utime (μs), iso_utc, iso_est, cond, temp_celsius, tsys_celsius, pressure_dbar,
  plus *_dt_us columns when using nearest matching.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import os
import h5py
import numpy as np
import pandas as pd


# ---- time helpers ----
def est_to_utime_us(dt_est_str: str) -> int:
    est = ZoneInfo("America/New_York")
    dt_est = datetime.strptime(dt_est_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=est)
    dt_utc = dt_est.astimezone(timezone.utc)
    return int(dt_utc.timestamp() * 1_000_000)

def utime_us_to_iso_strings(utime_us: np.ndarray):
    est = ZoneInfo("America/New_York")
    iso_utc, iso_est = [], []
    for u in utime_us:
        dt_utc = datetime.fromtimestamp(u / 1_000_000, tz=timezone.utc)
        dt_est = dt_utc.astimezone(est)
        iso_utc.append(dt_utc.isoformat(timespec="seconds"))
        iso_est.append(dt_est.isoformat(timespec="seconds"))
    return iso_utc, iso_est


# ---- H5 loading ----
def load_streams_from_h5(h5_path: str):
    with h5py.File(h5_path, "r") as f:
        cond = f["jaiabot::salinity/jaiabot.protobuf.SalinityData/conductivity"][:]
        t_cond = f["jaiabot::salinity/jaiabot.protobuf.SalinityData/_utime_"][:]

        temp = f["jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/temperature"][:]
        t_temp = f["jaiabot::pressure_temperature/jaiabot.protobuf.PressureTemperatureData/_utime_"][:]

        pres = f["jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/pressure_adjusted"][:]
        t_pres = f["jaiabot::pressure_adjusted/jaiabot.protobuf.PressureAdjustedData/_utime_"][:]

        tsys = f["jaiabot::tsys01/jaiabot.protobuf.TSYS01Data/temperature"][:]
        t_tsys = f["jaiabot::tsys01/jaiabot.protobuf.TSYS01Data/_utime_"][:]
    return (t_cond, cond), (t_temp, temp), (t_pres, pres), (t_tsys, tsys)


# ---- alignment helpers ----
def filter_by_window(t_us: np.ndarray, x: np.ndarray, t0_us: int, t1_us: int):
    mask = (t_us >= t0_us) & (t_us <= t1_us)
    return t_us[mask], x[mask]

def sort_by_time(t_us: np.ndarray, x: np.ndarray):
    idx = np.argsort(t_us)
    return t_us[idx], x[idx]

def nearest_align(base_t: np.ndarray, target_t: np.ndarray, target_x: np.ndarray, max_diff_us: int):
    aligned = np.full(base_t.shape, np.nan, dtype=float)
    dt_us = np.zeros(base_t.shape, dtype=np.int64)
    for i, tb in enumerate(base_t):
        idx = np.searchsorted(target_t, tb)
        candidates = []
        if idx < len(target_t): candidates.append(idx)
        if idx > 0:              candidates.append(idx - 1)
        best_val, best_abs, best_diff = None, None, None
        for j in candidates:
            diff = int(target_t[j]) - int(tb)
            ad = abs(diff)
            if best_abs is None or ad < best_abs:
                best_abs = ad
                best_diff = diff
                best_val = float(target_x[j])
        if best_abs is not None and best_abs <= max_diff_us:
            aligned[i] = best_val
            dt_us[i]  = int(best_diff)
        else:
            aligned[i] = np.nan
            dt_us[i]  = 0
    return aligned, dt_us

def linear_align(base_t: np.ndarray, target_t: np.ndarray, target_x: np.ndarray):
    aligned = np.interp(
        base_t.astype(float),
        target_t.astype(float),
        target_x.astype(float),
        left=np.nan, right=np.nan,
    )
    dt_us = np.zeros_like(base_t, dtype=np.int64)
    return aligned, dt_us


# ---- high-level align ----
def build_aligned_dataframe(
    h5_path: str,
    start_est: str,
    end_est: str,
    method: str = "nearest",
    base_timeline: str = "cond",
    max_diff_us: int = 150_000,
) -> pd.DataFrame:
    t0_us = est_to_utime_us(start_est)
    t1_us = est_to_utime_us(end_est)
    if t1_us <= t0_us:
        raise ValueError("End time must be after start time.")

    (t_cond, cond), (t_temp, temp), (t_pres, pres), (t_tsys, tsys) = load_streams_from_h5(h5_path)

    t_cond, cond = filter_by_window(t_cond, cond, t0_us, t1_us)
    t_temp, temp = filter_by_window(t_temp, temp, t0_us, t1_us)
    t_pres, pres = filter_by_window(t_pres, pres, t0_us, t1_us)
    t_tsys, tsys = filter_by_window(t_tsys, tsys, t0_us, t1_us)

    t_cond, cond = sort_by_time(t_cond, cond)
    t_temp, temp = sort_by_time(t_temp, temp)
    t_pres, pres = sort_by_time(t_pres, pres)
    t_tsys, tsys = sort_by_time(t_tsys, tsys)

    base_map = {
        "cond":     (t_cond, cond, "cond"),
        "temp":     (t_temp, temp, "temp_celsius"),
        "pressure": (t_pres, pres, "pressure_dbar"),
        "tsys":     (t_tsys, tsys, "tsys_celsius"),
    }
    if base_timeline not in base_map:
        raise ValueError(f"Invalid base_timeline '{base_timeline}'")
    base_t, base_x, base_name = base_map[base_timeline]
    if base_t.size == 0:
        raise RuntimeError(f"No data points for base timeline '{base_timeline}' in the requested window.")

    align = (lambda bt, tt, xx: nearest_align(bt, tt, xx, max_diff_us)) if method == "nearest" else linear_align

    df = pd.DataFrame({"utime": base_t.astype(np.int64)})
    iso_utc, iso_est = utime_us_to_iso_strings(df["utime"].to_numpy())
    df["iso_utc"] = iso_utc
    df["iso_est"] = iso_est
    df[base_name] = base_x.astype(float)

    if base_name != "cond" and t_cond.size > 0:
        x, dt = align(base_t, t_cond, cond)
        df["cond"] = x
        if method == "nearest": df["cond_dt_us"] = dt

    if base_name != "temp_celsius" and t_temp.size > 0:
        x, dt = align(base_t, t_temp, temp)
        df["temp_celsius"] = x
        if method == "nearest": df["temp_dt_us"] = dt

    if base_name != "tsys_celsius" and t_tsys.size > 0:
        x, dt = align(base_t, t_tsys, tsys)
        df["tsys_celsius"] = x
        if method == "nearest": df["tsys_dt_us"] = dt

    if base_name != "pressure_dbar" and t_pres.size > 0:
        x, dt = align(base_t, t_pres, pres)
        df["pressure_dbar"] = x
        if method == "nearest": df["pressure_dt_us"] = dt

    return df


# ---- utility ----
def default_output_csv(h5_path: str) -> str:
    stem = os.path.splitext(os.path.basename(h5_path))[0]
    return os.path.join(os.path.dirname(h5_path), f"{stem}_svp_matched.csv")

def save_csv(df: pd.DataFrame, out_csv: str):
    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    df.to_csv(out_csv, index=False)
