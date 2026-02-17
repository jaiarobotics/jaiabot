import numpy as np
import pandas as pd

# --- Constants for Analysis ---
DRIFT_ARDUINO_VALUE = 1500
MIN_DRIFT_LEN_PTS = 300
MOTOR_STOP_MOMENTUM_PERIOD_S = 1.5 # TODO: determine upper bound for vehicle to come to a stop from full throttle, current value is somewhat arbitrary

# --- Data Analysis Functions ---

def extract_drift_segments(stationkeep_df):
    """
    Identifies and extracts drift segments from station-keeping data.

    A drift is a period where the motor is off (at DRIFT_ARDUINO_VALUE).
    """
    timestamps = stationkeep_df['ts'].to_numpy()
    motor_values = stationkeep_df['motor'].to_numpy()
    
    is_drifting = (motor_values == DRIFT_ARDUINO_VALUE)
    is_drifting_padded = np.r_[False, is_drifting, False]

    drift_starts = np.flatnonzero(~is_drifting_padded[:-1] & is_drifting_padded[1:])
    drift_ends = np.flatnonzero(is_drifting_padded[:-1] & ~is_drifting_padded[1:])

    drifts = []
    for start_idx, end_idx in zip(drift_starts, drift_ends):
        if (end_idx - start_idx) < MIN_DRIFT_LEN_PTS:
            continue

        drift_timestamps = timestamps[start_idx:end_idx]
        drift_start_ts = drift_timestamps[0]
        
        momentum_clear_ts = drift_start_ts + MOTOR_STOP_MOMENTUM_PERIOD_S
        momentum_clear_index = start_idx + np.argmax(drift_timestamps > momentum_clear_ts)

        if momentum_clear_index < end_idx:
            segment_df = stationkeep_df.iloc[momentum_clear_index:end_idx]
            drift_seg = {
                "epoch_time": segment_df['ts'].to_numpy(),
                "pressure":   segment_df['pressure'].to_numpy(),
                "speed":      segment_df['speed'].to_numpy(),
                "latitude":   segment_df['lat'].to_numpy(),
                "longitude":  segment_df['lon'].to_numpy(),
            }
            drifts.append(drift_seg)
    
    return drifts

def create_pressure_mask(pressure, threshold=0.05):
    """Creates a boolean mask for pressure values greater than a threshold."""
    return pressure > threshold

def create_speed_mask(speed, threshold=1.25):
    """Creates a boolean mask for speed values below a threshold."""
    return speed < threshold

def filter_current_data(drift, use_pressure=True, use_speed=True):
    """
    Computes filters for a single drift segment and returns the mask to filter data.
    """
    final_mask = np.ones_like(drift["epoch_time"], dtype=bool)

    if use_pressure:
        final_mask &= create_pressure_mask(drift["pressure"])

    if use_speed:
        final_mask &= create_speed_mask(drift["speed"])
    
    return {**drift, "final_mask": final_mask}

def calculate_bearing_from_components(east_component, north_component):
    """Converts east/north components to a bearing in degrees [0, 360)."""
    return np.rad2deg((np.pi / 2 - np.arctan2(north_component, east_component)) % (2 * np.pi))

def compute_drift_statistics(drift):
    """Computes direction and speed statistics for a single filtered drift segment."""
    mask = drift["final_mask"]
    filtered_lon = drift["longitude"][mask]
    filtered_lat = drift["latitude"][mask]
    speed_valid = drift["speed"][mask]

    stats = {
        "bearing_line": np.nan, "speed_mean": np.nan, 
        "speed_mode_rayleigh": np.nan, "R2": np.nan,
        "filtered_lon": filtered_lon, "filtered_lat": filtered_lat,
    }

    if len(filtered_lon) < 2:
        return stats

    # Speed stats
    mean_v2 = np.nanmean(speed_valid ** 2)
    if np.isfinite(mean_v2) and mean_v2 > 0:
        sigma_hat = np.sqrt(mean_v2 / 2.0)
        stats["speed_mode_rayleigh"] = sigma_hat

    # Drift direction by line fit
    # scale lon by cosine of lat angle to linearly correlate the variables
    # distance between latitude lines are constant while distance between longitude lines approaches zero as you approach the poles
    scaled_filtered_lon = filtered_lon * np.cos(np.deg2rad(np.nanmean(filtered_lat))) 

    # Guard against zero-variance data that would cause np.polyfit to emit RankWarning or fail
    # If all latitudes or all scaled longitudes are identical, the linear fit is ill-posed.
    if np.nanmin(filtered_lat) == np.nanmax(filtered_lat) or np.nanmin(scaled_filtered_lon) == np.nanmax(scaled_filtered_lon):
        return stats
    a, b = np.polyfit(scaled_filtered_lon, filtered_lat, 1)

    lat_pred = a * scaled_filtered_lon + b
    ss_res = np.sum((filtered_lat - lat_pred) ** 2)
    ss_tot = np.sum((filtered_lat - np.mean(filtered_lat)) ** 2)
    stats["R2"] = 1.0 - ss_res / ss_tot if ss_tot > 0 else np.nan

    line_vector = np.array([1.0, a])
    net_displacement = np.array([scaled_filtered_lon[-1] - scaled_filtered_lon[0], filtered_lat[-1] - filtered_lat[0]])
    if np.dot(line_vector, net_displacement) < 0:
        line_vector *= -1

    dlon_line, dlat_line = line_vector
    stats["bearing_line"] = calculate_bearing_from_components(dlon_line, dlat_line)

    return stats

def wrap_degrees_180(degrees):
    """Wraps degrees to the range [-180, 180]."""
    return (degrees + 180) % 360 - 180

def calculate_std_about_value(values, center):
    """Calculates standard deviation about a fixed center value."""
    values = np.asarray(values, dtype=float)
    mask = np.isfinite(values) & np.isfinite(center)
    return np.sqrt(np.mean((values[mask] - center) ** 2)) if mask.sum() >= 2 else np.nan

def calculate_circular_std_about_value_deg(angles_deg, center_deg):
    """Calculates circular standard deviation (in degrees) about a fixed center angle."""
    angles = np.asarray(angles_deg, dtype=float)
    if not np.isfinite(center_deg): return np.nan
    mask = np.isfinite(angles)
    if mask.sum() < 2: return np.nan
    residuals = wrap_degrees_180(angles[mask] - center_deg)
    return np.sqrt(np.mean(residuals ** 2))

def summarize_station_keep_drifts(drifts, r2_threshold=0.5):
    """
    Computes statistics for each drift, filters by R², and calculates overall averages.
    """
    if not drifts:
        return {}

    drift_stats_list = [compute_drift_statistics(filter_current_data(d)) for d in drifts]
    good_drifts_stats = [
        s
        for s in drift_stats_list
        if (
            (r2_value := s.get("R2", np.nan)) is not None
            and not np.isnan(r2_value)
            and r2_value > r2_threshold
        )
    ]

    if not good_drifts_stats:
        return {}

    bearings = np.array([s["bearing_line"] for s in good_drifts_stats if np.isfinite(s["bearing_line"])])
    speed_modes = np.array([s["speed_mode_rayleigh"] for s in good_drifts_stats if np.isfinite(s["speed_mode_rayleigh"])])

    mean_bearing = (np.rad2deg(np.arctan2(np.nanmean(np.sin(np.deg2rad(bearings))), np.nanmean(np.cos(np.deg2rad(bearings))))) + 360) % 360 if bearings.size > 0 else np.nan
    avg_mode_speed = np.nanmean(speed_modes) if speed_modes.size > 0 else np.nan
    
    speed_std = calculate_std_about_value(speed_modes, avg_mode_speed) 
    dir_std = calculate_circular_std_about_value_deg(bearings, mean_bearing)

    # Collect non-empty filtered latitude/longitude arrays
    lat_arrays = []
    lon_arrays = []
    for s in good_drifts_stats:
        lat = s.get("filtered_lat")
        lon = s.get("filtered_lon")
        # Skip if missing or empty
        if lat is None or lon is None:
            continue
        if np.size(lat) == 0 or np.size(lon) == 0:
            continue
        lat_arrays.append(lat)
        lon_arrays.append(lon)

    if lat_arrays and lon_arrays:
        lats = np.concatenate(lat_arrays)
        lons = np.concatenate(lon_arrays)
        mean_lat = np.nanmean(lats)
        mean_lon = np.nanmean(lons)
    else:
        # No position data available from good drifts
        mean_lat = np.nan
        mean_lon = np.nan
    return {
        "mean_bearing": mean_bearing,
        "avg_mode_speed": avg_mode_speed,
        "speed_std_about_reported_mean": speed_std,
        "dir_std_about_reported_mean": dir_std,
        "n_good_drifts": len(good_drifts_stats),
        "mean_lat": mean_lat,
        "mean_lon": mean_lon
    }
