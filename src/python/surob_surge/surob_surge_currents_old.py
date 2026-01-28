import csv
import os
import socket
import shutil
import time
import numpy as np
import pandas as pd
import google.protobuf.message as pbm
from jaiabot.messages.moos_pb2 import MOOSMessage 
from goby.middleware.protobuf.gpsd_pb2 import TimePositionVelocity as tpv
from jaiabot.messages.arduino_pb2 import ArduinoResponse
from jaiabot.messages.pressure_temperature_pb2 import PressureAdjustedData
from jaiabot.messages.jaia_dccl_pb2 import BotStatus, CurrentPacket


def split_into_drifts(stationkeep_df):
    drift_arduino_value = 1500
    min_drift_len=300
    # time for jaiabot to come to a stop after motor turns off
    dt_m = 1.5 # s

    sk_epoch = stationkeep_df['ts'].to_numpy()
    sk_ard = stationkeep_df['motor'].to_numpy()
    sk_pres = stationkeep_df['pressure'].to_numpy()
    sk_speed = stationkeep_df['speed'].to_numpy()
    sk_lat = stationkeep_df['lat'].to_numpy()
    sk_lon = stationkeep_df['lon'].to_numpy()

    is_drift = (sk_ard == drift_arduino_value)
    y_d = np.r_[False, is_drift, False]

    d_starts = np.flatnonzero(~y_d[:-1] & y_d[1:])
    d_ends   = np.flatnonzero(y_d[:-1] & ~y_d[1:])

    drifts = []

    for ds, de in zip(d_starts, d_ends):
        if (de - ds) < min_drift_len:
            continue  # skip very short blips if desired

        drift_timestamps = sk_epoch[ds:de]
        drift_start_ts = drift_timestamps[0]
        ds_m = np.argmax(drift_timestamps > (drift_start_ts + dt_m)) # skip drift periods where the bot still carries momentum from motor
        drift_seg = {
            "index_range": (ds_m, de),          # indices within THIS station keep
            "epoch_time": sk_epoch[ds_m:de],
            "pressure":   sk_pres[ds_m:de],
            "arduino":    sk_ard[ds_m:de],
            "speed":      sk_speed[ds_m:de],
            "latitude":   sk_lat[ds_m:de],
            "longitude":  sk_lon[ds_m:de],
        }
        drifts.append(drift_seg)
    
    return drifts


def pressure_check_filter(pressure, mask_extra=None) -> np.ndarray:
    """
    Create a boolean mask indicating where interpolated pressure
    is greater than a threshold. Optionally AND with another mask.
    """

    thresh = 0.05  # pressure threshold in meters

    mask_bool = pressure > thresh

    if mask_extra is not None:
        mask_bool = mask_bool & np.asarray(mask_extra, dtype=bool)

    return mask_bool


def speed_filter(speed, mask_extra=None, thresh=1.25) -> np.ndarray:
    """
    Return a boolean mask where speed is below a given threshold.
    """

    # Primary mask
    mask_bool = speed < thresh

    if mask_extra is not None:
        mask_bool = mask_bool & np.asarray(mask_extra, dtype=bool)

    return mask_bool


def filter_currents(
        speed, epoch_time,
        pressure,
        use_pressure=True,
        use_speed=True,
):
    """
    Create a combined boolean mask for filtering current data,
    with optional filters that may be enabled/disabled.

    Returns
    -------
    final_mask : np.ndarray (bool)
        Combined mask of all enabled filters.
    filtered_speed : np.ndarray (float)
        Speed array where filtered-out points are np.nan.
    """

    final_mask = np.ones_like(epoch_time, dtype=bool)

    # ---- 2. Wet / pressure ----
    if use_pressure:
        wet_mask = pressure_check_filter(
            pressure,
            mask_extra=final_mask
        )
        final_mask &= wet_mask

    # ---- 5. Speed filter ----
    if use_speed:
        speed_mask = speed_filter(
            speed,
            mask_extra=final_mask
        )
        final_mask &= speed_mask
    
    filtered_speed = np.where(final_mask, speed, np.nan)

    return final_mask, filtered_speed


def bearing_from_components(dE, dN):
    """
    Convert east/north components (dE, dN) to a bearing (deg) from true north,
    clockwise, in [0, 360).

    dE: east component (x)
    dN: north component (y)
    """
    return np.rad2deg((np.pi / 2 - np.arctan2(dN, dE)) % (2 * np.pi))


def compute_drift_stats(drift, n_edge_points=10, use_mask=True):
    """
    Compute drift direction (3 ways) and speed stats (mean, median, mode)
    for a single drift dictionary.

    Parameters
    ----------
    drift : dict
        Must contain keys:
          - "longitude", "latitude"
          - "filtered_speed"
          - "final_mask" (if use_mask=True)
    n_edge_points : int
        Number of points from start/end used for the first/last method.
    use_mask : bool
        If True, use drift["final_mask"] to select valid points.

    Returns
    -------
    stats : dict
        {
          'longitude', 'latitude', 'speed', 'mask', 'time',
          'filtered_lon', 'filtered_lat',       # filtered lat/lon
          'bearing_line',                # deg, line fit lat = a(lon*cos(lat)) + b
          'speed_mean', 'speed_median',
          'speed_mode_rayleigh',         # mode assuming Rayleigh dist
          'R2'                           # R² of line fit
        }
    """
    lon = np.asarray(drift["longitude"])
    lat = np.asarray(drift["latitude"])
    speed = np.asarray(drift["filtered_speed"])
    time = np.asarray(drift["epoch_time"])

    # Mask for "good" points
    if use_mask and "final_mask" in drift:
        mask = np.asarray(drift["final_mask"], dtype=bool)
    else:
        mask = np.isfinite(speed)

    # Filtered positions & speeds
    filtered_lon = lon[mask]
    filtered_lat = lat[mask]
    speed_valid = speed[mask]

    stats = {
        "longitude": lon,
        "latitude": lat,
        "speed": speed,
        "mask": mask,
        "time": time,
        "filtered_lon": filtered_lon,
        "filtered_lat": filtered_lat,
        "bearing_line": np.nan,
        "speed_mean": np.nan,
        "speed_mode_rayleigh": np.nan,
        "R2": np.nan,
    }

    # Need at least 2 valid points for direction (and speed)
    if len(filtered_lon) < 2:
        return stats

    # ---------- Speed stats ----------
    stats["speed_mean"] = np.nanmean(speed_valid)

    # Rayleigh mode: sigma_hat = sqrt( mean(v^2) / 2 ), mode = sigma_hat
    mean_v2 = np.nanmean(speed_valid ** 2)
    if np.isfinite(mean_v2) and mean_v2 > 0:
        sigma_hat = np.sqrt(mean_v2 / 2.0)
        stats["speed_mode_rayleigh"] = sigma_hat

    # ---------- 1) Drift direction by line fit (all valid points) ----------
    # Fit lat = a(lon*cos(lat)) + b
    filtered_lon = filtered_lon*np.cos(np.deg2rad(np.nanmean(filtered_lat)))
    a, b = np.polyfit(filtered_lon, filtered_lat, 1)  # uses least squares to fit a line to the drift points

    # The method to find the R² value for the fitted line and the drift points
    lat_pred = a * filtered_lon + b
    SS_res = np.sum((filtered_lat - lat_pred) ** 2)  # how far the points deviate from the line
    SS_tot = np.sum((filtered_lat - np.mean(filtered_lat)) ** 2)  # total variance in N
    if SS_tot > 0:
        R2 = 1.0 - SS_res / SS_tot
    else:
        R2 = np.nan
    stats["R2"] = R2

    # Line direction vector (arbitrary orientation at first)
    v_line = np.array([1.0, a])

    # Net displacement from first to last valid point
    v_net = np.array([filtered_lon[-1] - filtered_lon[0], filtered_lat[-1] - filtered_lat[0]])  # determine which way the drift actually moved

    # If line vector points opposite to net motion, flip it
    if np.dot(v_line, v_net) < 0:
        v_line *= -1

    dlon_line, dlat_line = v_line

    stats["bearing_line"] = bearing_from_components(dlon_line,
                                                    dlat_line)  # convert the direction vector into a compass bearing

    return stats


def wrap_deg180(x_deg):
    """Wrap degrees to [-180, 180]."""
    return (x_deg + 180) % 360 - 180


def std_about_value(values, center):
    """STD about a fixed center (not about the sample mean)."""
    values = np.asarray(values, dtype=float)
    mask = np.isfinite(values) & np.isfinite(center)
    if mask.sum() < 2:
        return np.nan
    return np.sqrt(np.mean((values[mask] - center) ** 2))


def circular_std_about_value_deg(angles_deg, center_deg):
    """Circular STD (deg) about a fixed center angle (deg)."""
    a = np.asarray(angles_deg, dtype=float)
    if not np.isfinite(center_deg):
        return np.nan
    mask = np.isfinite(a)
    if mask.sum() < 2:
        return np.nan
    d = wrap_deg180(a[mask] - center_deg)  # signed residuals in [-180,180]
    return np.sqrt(np.mean(d ** 2))


def summarize_filtered_station_keep(
        drifts,
        n_edge_points=10,
        use_mask=True,
        R2_threshold=0.5,
):
    """
    Load drifts from a list of filtered station keeps compute stats for each drift,
    keep only drifts with R² > R2_threshold, and compute average bearing and
    representative speeds (mode, mean, median) over those "good" drifts.

    Modified to remove file read to more accurately emulate on-vehicle per station keep computation

    Returns
    -------
    result : dict
        {
          'drifts': drifts,
          'stats': drift_stats_list,
          'drifts_good': drifts_good,
          'stats_good': stats_good,
          'mean_bearing': mean_bearing,
          'avg_mode_speed': avg_mode_speed,
          'avg_mean_speed': avg_mean_speed,
          'R2_threshold': R2_threshold,
        }
    """

    if len(drifts) == 0:
        return {
            "drifts": [],
            "stats": [],
            "drifts_good": [],
            "stats_good": [],
            "mean_bearing": np.nan,
            "avg_mode_speed": np.nan,
            "avg_mean_speed": np.nan,
            "R2_threshold": R2_threshold,
        }

    # 1) Compute per-drift stats
    drift_stats_list = [compute_drift_stats(d, n_edge_points=n_edge_points, use_mask=use_mask)
                        for d in drifts]

    # 2) Filter by R²
    R2_values = np.array([s["R2"] for s in drift_stats_list])
    good_mask = np.isfinite(R2_values) & (R2_values > R2_threshold)

    drifts_good = [d for d, keep in zip(drifts, good_mask) if keep]
    stats_good = [s for s, keep in zip(drift_stats_list, good_mask) if keep]

    if len(stats_good) == 0:
        return {
            "drifts": drifts,
            "stats": drift_stats_list,
            "drifts_good": [],
            "stats_good": [],
            "mean_bearing": np.nan,
            "avg_mode_speed": np.nan,
            "avg_mean_speed": np.nan,
            "R2_threshold": R2_threshold,
            "mean_lat": np.nan,
            "mean_lon": np.nan,
        }

    # 3) Extract bearing_line and speeds from good drifts
    bearings = np.array([
        s["bearing_line"] for s in stats_good
        if np.isfinite(s["bearing_line"])
    ])

    speed_mode = np.array([
        s["speed_mode_rayleigh"] for s in stats_good
        if np.isfinite(s["speed_mode_rayleigh"])
    ])

    speed_mean = np.array([
        s["speed_mean"] for s in stats_good
        if np.isfinite(s["speed_mean"])
    ])

    lats = [s["filtered_lat"] for s in stats_good]
    lons = [s["filtered_lon"] for s in stats_good]
    lats = np.concatenate(lats)
    lons = np.concatenate(lons)
    mean_lat = np.nanmean(lats)
    mean_lon = np.nanmean(lons)

    # 4) Circular mean of bearings
    if bearings.size > 0:
        rad = np.deg2rad(bearings)
        mean_rad = np.arctan2(np.nanmean(np.sin(rad)), np.nanmean(np.cos(rad)))
        mean_bearing = (np.rad2deg(mean_rad) + 360) % 360
    else:
        mean_bearing = np.nan

    # 5) Average speed stats (plain mean over good drifts)
    avg_mode_speed = np.nanmean(speed_mode) if speed_mode.size > 0 else np.nan
    avg_mean_speed = np.nanmean(speed_mean) if speed_mean.size > 0 else np.nan

    speed_std_about_reported_mean = ( # TODO: ask if std should be computed from speed_mode & avg_mode_speed
        std_about_value(speed_mean, avg_mode_speed)
        if speed_mean.size > 0 and np.isfinite(avg_mode_speed) else np.nan
    )

    dir_std_about_reported_mean = (
        circular_std_about_value_deg(bearings, mean_bearing)
        if bearings.size > 0 and np.isfinite(mean_bearing) else np.nan
    )

    return {
        "drifts": drifts,
        "stats": drift_stats_list,
        "drifts_good": drifts_good,
        "stats_good": stats_good,
        "mean_bearing": mean_bearing,
        "avg_mode_speed": avg_mode_speed,
        "avg_mean_speed": avg_mean_speed,
        "R2_threshold": R2_threshold,

        # NEW:
        "speed_std_about_reported_mean": speed_std_about_reported_mean,  # m/s
        "dir_std_about_reported_mean": dir_std_about_reported_mean,  # deg
        "n_good_drifts": int(len(stats_good)),
        "mean_lat": mean_lat,
        "mean_lon": mean_lon
    }


localHost = "127.0.0.1"
port = 51200 # TODO: get list of unused ports from Matt Ferro
buffer_size = 1024

save_dir = "/var/log/jaiabot/tmp_currents"

gps_csv_header = ['ts','lat','lon','speed']
arduino_csv_header = ['ts','motor']
pressure_csv_header = ['ts','pressure']

# TODO: investigate udp_driver.proto
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((localHost, port))
timeout_seconds = 2
sock.settimeout(timeout_seconds)

station_keep_ts = 0
curr_station_keep_subdir = ""

while True:
    # PHASE 1: WAITING FOR STATION_KEEP START
    try:
        data, addr = sock.recvfrom(1024)
    except socket.timeout:
        time.sleep(8) # C++ UDP bridge is not sending JAIABOT_MISSION_STATE messages rn, sleep to relinguish CPU time
        continue
    
    try:
        # assumes that MOOSMessages are published at a regular interval indicating which state the bot is in
        curr_task = MOOSMessage() #TODO: ask Matt Ferro how to pass stationkeep coords/ associate current estimate with stationkeep ID (MOOSMessage.id ?)
        curr_task.ParseFromString(data)
    
    except pbm.DecodeError:
        continue

    if curr_task.key == "JAIABOT_MISSION_STATE" and curr_task.HasField("sValue") and curr_task.svalue == "IN_MISSION__UNDERWAY__TASK__STATION_KEEP":
        # PHASE 2: LOG GPS, MOTOR STATUS, and PRESSURE DATA
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        station_keep_ts = int(time.time())
        curr_station_keep_subdir = os.path.join(save_dir, str(station_keep_ts))
        os.mkdir(curr_station_keep_subdir)

        gps_csv_path = os.path.join(curr_station_keep_subdir, "gps.csv")
        arduino_csv_path = os.path.join(curr_station_keep_subdir, "arduino.csv")
        pressure_csv_path = os.path.join(curr_station_keep_subdir, "pressure.csv")
        
        # CSVs for each data group
        gps_file = open(gps_csv_path)
        gps_writer = csv.writer(gps_file)
        gps_writer.writerow(gps_csv_header)

        arduino_file = open(arduino_csv_path)
        arduino_writer = csv.writer(arduino_file)
        arduino_writer.writerow(arduino_csv_header)

        pressure_file = open(pressure_csv_path)
        pressure_writer = csv.writer(pressure_file)
        pressure_writer.writerow(pressure_csv_header)

        # loop logging relevent data streams until stationkeep ends
        while True:
            try:
                data, addr = sock.recvfrom(1024)
            except socket.timeout:
                continue

            curr_ts = time.time()
            curr_tpv = None
            curr_arduino_response = None
            curr_pressure_adjusted_data = None
            curr_moos_message = None

            try:
                curr_tpv = tpv()
                curr_tpv.ParseFromString(data)
            except pbm.DecodeError:
                curr_tpv = None
            
            try:
                curr_arduino_response = ArduinoResponse()
                curr_arduino_response.ParseFromString(data)
            except pbm.DecodeError:
                curr_arduino_response = None

            try:
                curr_pressure_adjusted_data = PressureAdjustedData()
                curr_pressure_adjusted_data.ParseFromString(data)
            except pbm.DecodeError:
                curr_pressure_adjusted_data = None

            try:
                curr_moos_message = MOOSMessage()
                curr_moos_message.ParseFromString(data)
            except pbm.DecodeError:
                curr_moos_message = None

            if curr_tpv is not None:
                if curr_tpv.HasField('time'):
                    curr_ts = curr_tpv.time
                
                curr_lat = None
                curr_lon = None
                curr_speed = None
                if curr_tpv.HasField('location'):
                    curr_lat = curr_tpv.location.lat
                    curr_lon = curr_tpv.location.lon
                if curr_tpv.HasField('speed'):
                    curr_speed = curr_tpv.speed

                if curr_lat is not None and curr_speed is not None:
                    # all necessary fields of tpv message populated
                    gps_data_row = [curr_ts, curr_lat, curr_lon, curr_speed]
                    gps_writer.writerow(gps_data_row)

            elif curr_arduino_response is not None:
                if curr_arduino_response.HasField('motor'):
                    arduino_data_row = [curr_ts, curr_arduino_response.motor]
                    arduino_writer.writerow(arduino_data_row)
            
            elif curr_pressure_adjusted_data is not None:
                if curr_pressure_adjusted_data.HasField('pressure_adjusted'):
                    pressure_data_row = [curr_ts, curr_pressure_adjusted_data.pressure_adjusted]
                    pressure_writer.writerow(pressure_data_row)

            elif curr_moos_message is not None:
                if (curr_task.key == "JAIABOT_MISSION_STATE" and 
                   curr_task.HasField("sValue") and 
                   curr_task.svalue != "IN_MISSION__UNDERWAY__TASK__STATION_KEEP" and
                   "IN_MISSION__PAUSE" not in curr_task.svalue): 
                    break
            else:
                continue
        
        # PHASE 3: COMPUTE CURRENT STATS
        gps_file.close()
        arduino_file.close()
        pressure_file.close()

        gps_df = pd.read_csv(gps_csv_path)
        arduino_df = pd.read_csv(arduino_csv_path)
        pressure_df = pd.read_csv(pressure_csv_path)

        # interp arduino and pressure signals to GPS timestamps
        gps_time = gps_df['ts'].to_numpy()
        arduino_time = arduino_df['ts'].to_numpy()
        pressure_time = pressure_df['ts'].to_numpy()
        
        motor_data = arduino_df['motor'].to_numpy()
        pressure_data = pressure_df['pressure'].to_numpy()

        motor_interp = np.interp(gps_time, arduino_time, motor_data, left=np.nan, right=np.nan)
        pressure_interp = np.interp(gps_time, pressure_time, pressure_data, left=np.nan, right=np.nan)

        gps_df['motor'] = motor_interp
        gps_df['pressure'] = pressure_interp

        gps_df.dropna(inplace=True)

        drifts = split_into_drifts(gps_df)

        for i, drift in enumerate(drifts):
            epoch_time = drift["epoch_time"]
            speed = drift["speed"]
            pressure = drift["pressure"]
            lat = drift["latitude"]
            lon = drift["longitude"]

            # returns (final_mask, filtered_speed) based on your current filter_currents()
            final_mask, filtered_speed = filter_currents(
                speed, epoch_time,
                pressure,
                use_pressure=True,
                use_speed=True,
            )

            # Keep ONLY the variables you want to save in each drift
            drift_keep = {
                "speed": speed,
                "filtered_speed": filtered_speed,
                "latitude": lat,
                "longitude": lon,
                "epoch_time": epoch_time,
                "final_mask": final_mask
            }
            drift.clear()
            drift.update(drift_keep)

        result = summarize_filtered_station_keep(
            drifts,
            n_edge_points=10,
            use_mask=True,
            R2_threshold=0.5,
        )

        # PHASE 4: SEND CURRENT STATS AND DELETE TEMP FILES
        current = CurrentPacket()
        current.speed = result["avg_mode_speed"]
        current.speed_std = result["speed_std_about_reported_mean"]
        current.heading = result["mean_bearing"]
        current.heading_std = result["dir_std_about_reported_mean"]
        current.location.lat = result["mean_lat"]
        current.location.lon = result["mean_lon"]

        sock.sendto(current.SerializeToString().encode(), (localHost, port))
        shutil.rmtree(curr_station_keep_subdir, ignore_errors=True)

