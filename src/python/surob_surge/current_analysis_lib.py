import numpy as np
import pandas as pd

# --- Constants for Analysis ---
DRIFT_ARDUINO_VALUE = 1500
MIN_DRIFT_LEN_PTS = 50 # 50 gps pts ~= 10s duration @ 5hz
MOTOR_STOP_MOMENTUM_PERIOD_S = 1.5 # TODO: determine upper bound for vehicle to come to a stop from full throttle, current value is somewhat arbitrary
DEFAULT_SPEED_STDEV_MPS = 0.1
DEFAULT_DIRECTION_STDEV_DEG = 45.0

# --- Data Analysis Functions ---

def extract_drift_segments(stationkeep_df, log):
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
    log.info(f"Number of driftlet candidates: {len(drift_starts)}")

    drifts = []
    for start_idx, end_idx in zip(drift_starts, drift_ends):
        if (end_idx - start_idx) < MIN_DRIFT_LEN_PTS:
            log.warning(f"Driftlet was too short! Number of points {end_idx - start_idx}")
            continue

        log.info(f"Driftlet length: {end_idx - start_idx} points.")

        drift_timestamps = timestamps[start_idx:end_idx]
        drift_start_ts = drift_timestamps[0]
        
        momentum_clear_ts = drift_start_ts + MOTOR_STOP_MOMENTUM_PERIOD_S
        momentum_clear_index = start_idx + np.argmax(drift_timestamps > momentum_clear_ts) # np.argmax() returns 0 if no value in array is true

        if start_idx != momentum_clear_index and momentum_clear_index < end_idx:
            log.info(f"Driftlet length after accounting for momentum: {end_idx - momentum_clear_index} points.")
            segment_df = stationkeep_df.iloc[momentum_clear_index:end_idx]
            drift_seg = {
                "epoch_time": segment_df['ts'].to_numpy(),
                "speed":      segment_df['speed'].to_numpy(),
                "latitude":   segment_df['lat'].to_numpy(),
                "longitude":  segment_df['lon'].to_numpy(),
            }
            drifts.append(drift_seg)
        else:
            log.warning(f"Driftlet ended before momentum was cleared!")
    
    return drifts

def create_speed_mask(speed, threshold_mps=1.25):
    """Creates a boolean mask for speed values below a threshold. 1.25 m/s selected as rough "surfing" (bot carried by wave) speed threshold."""
    return speed < threshold_mps

def filter_current_data(drift, log, use_speed=True):
    """
    Computes filters for a single drift segment and returns the mask to filter data.
    """
    final_mask = np.ones_like(drift["epoch_time"], dtype=bool)
    log.info(f"Number of points in driftlet before filtering: {len(final_mask)}")

    if use_speed:
        speed_mask = create_speed_mask(drift["speed"])
        final_mask &= speed_mask
        log.info(f"Number of points filtered by speed mask: {np.sum(np.logical_not(speed_mask))}")

    log.info(f"Number of points in driftlet after filtering: {np.sum(final_mask)}")
    return {**drift, "final_mask": final_mask}

def calculate_heading_from_components(east_component, north_component):
    """Converts east/north components to a heading in degrees [0, 360)."""
    return np.rad2deg((np.pi / 2 - np.arctan2(north_component, east_component)) % (2 * np.pi))

def compute_drift_statistics(drift, log):
    """Computes direction and speed statistics for a single filtered drift segment."""
    mask = drift["final_mask"]
    filtered_lon = drift["longitude"][mask]
    filtered_lat = drift["latitude"][mask]
    speed_valid = drift["speed"][mask]

    stats = {
        "heading_angle": np.nan, 
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
        log.info(f"Driftlet speed: {sigma_hat} m/s")

    # Drift direction by line fit
    # scale lon by cosine of lat angle to linearly correlate the variables
    # distance between latitude lines are constant while distance between longitude lines approaches zero as you approach the poles
    scaled_filtered_lon = filtered_lon * np.cos(np.deg2rad(np.nanmean(filtered_lat))) 

    # Guard against zero-variance data that would cause np.polyfit to emit RankWarning or fail
    # If all latitudes or all scaled longitudes are identical, the linear fit is ill-posed.
    if np.nanmin(filtered_lat) == np.nanmax(filtered_lat) or np.nanmin(scaled_filtered_lon) == np.nanmax(scaled_filtered_lon):
        log.warning(f"Cannot perform polyfit for lat/lon coords. Zero variance in latitude or longitude data for this driftlet.")
        return stats
    a, b = np.polyfit(scaled_filtered_lon, filtered_lat, 1)

    lat_pred = a * scaled_filtered_lon + b
    ss_res = np.sum((filtered_lat - lat_pred) ** 2)
    ss_tot = np.sum((filtered_lat - np.mean(filtered_lat)) ** 2)
    stats["R2"] = 1.0 - ss_res / ss_tot if ss_tot > 0 else np.nan
    log.info(f"Driftlet R^2 fit: {stats['R2']}")

    line_vector = np.array([1.0, a])
    net_displacement = np.array([scaled_filtered_lon[-1] - scaled_filtered_lon[0], filtered_lat[-1] - filtered_lat[0]])
    if np.dot(line_vector, net_displacement) < 0:
        line_vector *= -1

    dlon_line, dlat_line = line_vector
    stats["heading_angle"] = calculate_heading_from_components(dlon_line, dlat_line)
    log.info(f"Driftlet heading: {stats['heading_angle']} degrees.")

    return stats

def summarize_station_keep_drifts(drifts, log):
    """
    Computes statistics for each drift, weights by R², and calculates overall averages.
    """
    if not drifts:
        log.warning(f"Can't compute average drift for this station keep, no driftlets provided.")
        return {}

    drift_stats_list = [compute_drift_statistics(filter_current_data(d, log), log) for d in drifts]
    good_drift_stats_df = pd.DataFrame(columns=["weight", "speed_mode_mps", "heading_rad"])
    for drift_stats_dict in drift_stats_list:
        good_drift_stats_df.loc[len(good_drift_stats_df)] = [drift_stats_dict.get("R2", np.nan), drift_stats_dict.get("speed_mode_rayleigh", np.nan), np.deg2rad(drift_stats_dict.get("heading_angle", np.nan))]
    good_drift_stats_df = good_drift_stats_df.dropna()

    if good_drift_stats_df.empty:
        log.warning(f"Can't compute average drift for this station keep, all provided driftlets missing at least one of the following: R2 Weight, Rayleigh Speed Mode, or Heading Angle.")
        return {}

    weights = good_drift_stats_df["weight"].to_numpy()
    magnitudes_mps = good_drift_stats_df["speed_mode_mps"].to_numpy()
    directions_rad = good_drift_stats_df["heading_rad"].to_numpy()

    W = np.sum(weights)

    if W <= 0: # very unlikely
        log.warning(f"Can't compute average drift for this station keep, all provided driflets have 0 R2 correlation.")
        return {}
    
    x_comps_mps = magnitudes_mps*np.cos(directions_rad)
    y_comps_mps = magnitudes_mps*np.sin(directions_rad)

    x_comp_weighted_mean_mps = np.sum(weights*x_comps_mps)/W
    y_comp_weighted_mean_mps = np.sum(weights*y_comps_mps)/W

    magnitude_weighted_mean_mps = np.linalg.norm([x_comp_weighted_mean_mps, y_comp_weighted_mean_mps], 2)
    direction_weighted_mean_deg = np.rad2deg(np.arctan2(y_comp_weighted_mean_mps, x_comp_weighted_mean_mps))
    direction_weighted_mean_deg = direction_weighted_mean_deg % 360

    log.info(f"Mean driftlet stats for this station keep:")
    log.info(f"Weighted Average Mode Speed: {magnitude_weighted_mean_mps} m/s.")
    log.info(f"Weighted Mean Heading: {direction_weighted_mean_deg} degrees.")

    if len(good_drift_stats_df) == 1:
        log.warning(f"Speed and direction standard deviations could not be calculated for this station keep! Too few driftlets. Using default standard deviation values instead.")
        speed_stdev = DEFAULT_SPEED_STDEV_MPS
        heading_stdev = DEFAULT_DIRECTION_STDEV_DEG
    else:
        magnitude_weighted_variance_mps_squared = np.sum(weights*np.square(magnitudes_mps-magnitude_weighted_mean_mps))/W
        magnitude_weighted_stdev_mps = np.sqrt(magnitude_weighted_variance_mps_squared)

        cosine_weighted_mean = np.sum(weights*np.cos(directions_rad))/W
        sine_weighted_mean = np.sum(weights*np.sin(directions_rad))/W
        resultant_length_weighted_mean = np.linalg.norm([cosine_weighted_mean, sine_weighted_mean], 2)
        resultant_length_weighted_mean = np.clip(resultant_length_weighted_mean, 1e-15, 1.0)
        direction_weighted_circular_stdev_rad = np.sqrt(-2.0*np.log(resultant_length_weighted_mean))
        direction_weighted_circular_stdev_deg = np.rad2deg(direction_weighted_circular_stdev_rad)
        direction_weighted_circular_stdev_deg = direction_weighted_circular_stdev_deg % 360

        speed_stdev = magnitude_weighted_stdev_mps
        heading_stdev = direction_weighted_circular_stdev_deg
        log.info(f"Mode Speed STD: {speed_stdev} m/s.")
        log.info(f"Heading STD: {heading_stdev} degrees.")

    # Collect non-empty filtered latitude/longitude arrays
    lat_arrays = []
    lon_arrays = []
    for s in drift_stats_list:
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
        log.info(f"Station Keep location: {mean_lat} lat, {mean_lon} lon")
    else:
        # No position data available from good drifts
        mean_lat = np.nan
        mean_lon = np.nan
        log.warning(f"Couldn't compute a mean location for this Station Keep!")
    return {
        "speed_mean_mps": magnitude_weighted_mean_mps,
        "heading_mean_deg": direction_weighted_mean_deg,
        "speed_stdev_mps": speed_stdev,
        "heading_stdev_deg": heading_stdev,
        "n_good_drifts": len(drift_stats_list),
        "mean_lat": mean_lat,
        "mean_lon": mean_lon
    }
